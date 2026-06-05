-- Function to increment occupied_credits on a wall
CREATE OR REPLACE FUNCTION increment_wall_credits(wall_id_param UUID, credits_param INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE walls
  SET occupied_credits = occupied_credits + credits_param,
      updated_at = NOW()
  WHERE id = wall_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
