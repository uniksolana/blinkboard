-- =====================================================================
-- 003: Pagos seguros, reservas atómicas y caducidad de slots
-- =====================================================================
-- Cambios:
--   * Todo el acceso a datos pasa por el servidor (service role). Se
--     eliminan las políticas RLS antiguas, que dependían de auth.uid()
--     (Supabase Auth, que no se usa). Con RLS activado y sin políticas,
--     la anon key ya no puede leer ni escribir nada directamente.
--   * Columnas nuevas para guardar el reparto exacto del pago.
--   * Funciones atómicas: reservar slot, confirmar compra, liberar
--     reservas y anuncios caducados.
-- =====================================================================

-- ---------- Políticas RLS: solo el servidor accede ----------
DROP POLICY IF EXISTS creators_select ON creators;
DROP POLICY IF EXISTS walls_select ON walls;
DROP POLICY IF EXISTS walls_insert ON walls;
DROP POLICY IF EXISTS walls_update ON walls;
DROP POLICY IF EXISTS slots_select ON slots;
DROP POLICY IF EXISTS purchases_select ON purchases;

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE walls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- ---------- Columnas nuevas ----------
-- auth0_id guarda el DID de Privy (se mantiene el nombre por compatibilidad)
COMMENT ON COLUMN creators.auth0_id IS 'Privy DID del usuario (did:privy:...)';

ALTER TABLE slots
  ADD COLUMN IF NOT EXISTS current_purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS amount_micro BIGINT,        -- total en unidades mínimas de USDC (6 decimales)
  ADD COLUMN IF NOT EXISTS fee_micro BIGINT DEFAULT 0, -- comisión de la plataforma
  ADD COLUMN IF NOT EXISTS payee_wallet TEXT,          -- wallet del creador que recibe el pago
  ADD COLUMN IF NOT EXISTS treasury_wallet TEXT,       -- wallet de la plataforma (comisión)
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- buyer_user_id puede ser NULL (compras desde el Blink sin sesión)
ALTER TABLE purchases ALTER COLUMN buyer_user_id DROP NOT NULL;

-- Una sola compra pendiente/activa por slot a la vez
CREATE INDEX IF NOT EXISTS idx_slots_current_purchase ON slots(current_purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchases_expires_at ON purchases(expires_at) WHERE status = 'CONFIRMED';

-- ---------- Recalcular créditos ocupados de un muro ----------
CREATE OR REPLACE FUNCTION recompute_wall_credits(p_wall_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE walls w
  SET occupied_credits = COALESCE((
        SELECT SUM(s.grid_size * s.grid_size)
        FROM slots s
        WHERE s.wall_id = w.id AND s.status = 'OCCUPIED'
      ), 0),
      updated_at = NOW()
  WHERE w.id = p_wall_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- Liberar reservas y anuncios caducados ----------
-- Devuelve el número de slots liberados.
CREATE OR REPLACE FUNCTION release_expired_slots(p_reservation_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
  v_released INTEGER := 0;
  v_count INTEGER;
  v_wall UUID;
BEGIN
  -- 1) Anuncios cuyo periodo ha terminado
  WITH ended AS (
    UPDATE purchases
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE status = 'CONFIRMED' AND expires_at <= NOW()
    RETURNING id, slot_id
  )
  UPDATE slots s
  SET status = 'AVAILABLE', current_purchase_id = NULL, reserved_at = NULL, updated_at = NOW()
  FROM ended
  WHERE s.id = ended.slot_id AND s.current_purchase_id = ended.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_released := v_released + v_count;

  -- 2) Reservas abandonadas (no se pagó a tiempo)
  WITH stale AS (
    UPDATE slots
    SET status = 'AVAILABLE', current_purchase_id = NULL, reserved_at = NULL, updated_at = NOW()
    WHERE status = 'RESERVED'
      AND reserved_at < NOW() - make_interval(mins => p_reservation_minutes)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM stale;
  v_released := v_released + v_count;

  -- Las compras pendientes antiguas pasan a EXPIRED (sin firma).
  -- Si después llega un pago válido, confirm_purchase puede recuperarlas.
  UPDATE purchases
  SET status = 'EXPIRED', updated_at = NOW()
  WHERE status = 'PENDING'
    AND tx_signature IS NULL
    AND created_at < NOW() - make_interval(mins => p_reservation_minutes);

  -- 3) Recalcular créditos de los muros con slots ocupados o recién liberados
  IF v_released > 0 THEN
    FOR v_wall IN SELECT id FROM walls LOOP
      PERFORM recompute_wall_credits(v_wall);
    END LOOP;
  END IF;

  RETURN v_released;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- Reservar un slot y crear la compra pendiente (atómico) ----------
-- Si p_slot_id es NULL, se elige el primer slot libre del tier indicado.
-- Lanza excepción 'SLOT_NOT_AVAILABLE' si no hay slot libre.
CREATE OR REPLACE FUNCTION reserve_slot_and_create_purchase(
  p_wall_id UUID,
  p_slot_id UUID,
  p_tier TEXT,
  p_buyer_user_id UUID,
  p_buyer_wallet TEXT,
  p_buyer_x_handle TEXT,
  p_buyer_x_id TEXT,
  p_buyer_avatar_url TEXT,
  p_amount_usdc NUMERIC,
  p_amount_micro BIGINT,
  p_fee_micro BIGINT,
  p_payee_wallet TEXT,
  p_treasury_wallet TEXT,
  p_duration TEXT,
  p_message TEXT,
  p_reservation_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (out_purchase_id UUID, out_slot_id UUID, out_tier TEXT) AS $$
DECLARE
  v_slot slots%ROWTYPE;
  v_purchase_id UUID;
  v_days INTEGER;
BEGIN
  IF p_slot_id IS NOT NULL THEN
    SELECT * INTO v_slot FROM slots s
    WHERE s.id = p_slot_id AND s.wall_id = p_wall_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_slot FROM slots s
    WHERE s.wall_id = p_wall_id AND s.tier = p_tier
      AND (s.status = 'AVAILABLE'
           OR (s.status = 'RESERVED' AND s.reserved_at < NOW() - make_interval(mins => p_reservation_minutes)))
    ORDER BY s.grid_y, s.grid_x
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF v_slot.id IS NULL THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  IF NOT (v_slot.status = 'AVAILABLE'
          OR (v_slot.status = 'RESERVED' AND v_slot.reserved_at < NOW() - make_interval(mins => p_reservation_minutes))) THEN
    RAISE EXCEPTION 'SLOT_NOT_AVAILABLE';
  END IF;

  -- La reserva anterior (caducada) deja de ser válida
  IF v_slot.current_purchase_id IS NOT NULL THEN
    UPDATE purchases SET status = 'EXPIRED', updated_at = NOW()
    WHERE id = v_slot.current_purchase_id AND status = 'PENDING';
  END IF;

  v_days := CASE p_duration WHEN 'DAILY' THEN 1 WHEN 'WEEKLY' THEN 7 ELSE 30 END;

  INSERT INTO purchases (
    slot_id, wall_id, buyer_user_id, buyer_wallet, buyer_x_handle, buyer_x_id,
    buyer_avatar_url, amount_usdc, amount_micro, fee_micro, payee_wallet,
    treasury_wallet, duration, starts_at, expires_at, status, message
  ) VALUES (
    v_slot.id, p_wall_id, p_buyer_user_id, p_buyer_wallet, p_buyer_x_handle, p_buyer_x_id,
    p_buyer_avatar_url, p_amount_usdc, p_amount_micro, p_fee_micro, p_payee_wallet,
    p_treasury_wallet, p_duration, NOW(), NOW() + make_interval(days => v_days), 'PENDING', p_message
  )
  RETURNING id INTO v_purchase_id;

  UPDATE slots
  SET status = 'RESERVED', reserved_at = NOW(), current_purchase_id = v_purchase_id, updated_at = NOW()
  WHERE id = v_slot.id;

  RETURN QUERY SELECT v_purchase_id, v_slot.id, v_slot.tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- Confirmar una compra ya verificada on-chain (atómico) ----------
-- Devuelve: CONFIRMED | ALREADY_CONFIRMED | SLOT_TAKEN | NOT_FOUND | INVALID_STATE
CREATE OR REPLACE FUNCTION confirm_purchase(p_purchase_id UUID, p_signature TEXT)
RETURNS TEXT AS $$
DECLARE
  v_purchase purchases%ROWTYPE;
  v_slot slots%ROWTYPE;
  v_days INTEGER;
BEGIN
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF v_purchase.id IS NULL THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_purchase.status = 'CONFIRMED' THEN
    RETURN 'ALREADY_CONFIRMED';
  END IF;

  -- Solo se pueden confirmar compras pendientes o reservas caducadas sin pagar
  IF NOT (v_purchase.status = 'PENDING'
          OR (v_purchase.status = 'EXPIRED' AND v_purchase.tx_signature IS NULL)) THEN
    RETURN 'INVALID_STATE';
  END IF;

  SELECT * INTO v_slot FROM slots WHERE id = v_purchase.slot_id FOR UPDATE;

  -- El slot sigue reservado para esta compra, o quedó libre: se puede ocupar
  IF (v_slot.status = 'RESERVED' AND v_slot.current_purchase_id = v_purchase.id)
     OR v_slot.status = 'AVAILABLE'
     OR (v_slot.status = 'RESERVED' AND v_slot.reserved_at < NOW() - INTERVAL '5 minutes') THEN

    v_days := CASE v_purchase.duration WHEN 'DAILY' THEN 1 WHEN 'WEEKLY' THEN 7 ELSE 30 END;

    -- Si otra reserva caducada ocupaba el slot, se invalida
    IF v_slot.current_purchase_id IS NOT NULL AND v_slot.current_purchase_id <> v_purchase.id THEN
      UPDATE purchases SET status = 'EXPIRED', updated_at = NOW()
      WHERE id = v_slot.current_purchase_id AND status = 'PENDING';
    END IF;

    UPDATE purchases
    SET status = 'CONFIRMED',
        tx_signature = p_signature,
        starts_at = NOW(),
        expires_at = NOW() + make_interval(days => v_days),
        failure_reason = NULL,
        updated_at = NOW()
    WHERE id = v_purchase.id;

    UPDATE slots
    SET status = 'OCCUPIED', current_purchase_id = v_purchase.id, reserved_at = NULL, updated_at = NOW()
    WHERE id = v_slot.id;

    PERFORM recompute_wall_credits(v_purchase.wall_id);
    RETURN 'CONFIRMED';
  END IF;

  -- Pagó, pero otra persona ocupó el slot mientras tanto: requiere reembolso manual
  UPDATE purchases
  SET status = 'FAILED',
      tx_signature = p_signature,
      failure_reason = 'SLOT_TAKEN_REFUND_REQUIRED',
      updated_at = NOW()
  WHERE id = v_purchase.id;
  RETURN 'SLOT_TAKEN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Solo el service role puede ejecutar estas funciones
REVOKE ALL ON FUNCTION recompute_wall_credits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_expired_slots(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reserve_slot_and_create_purchase(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION confirm_purchase(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION increment_wall_credits(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
