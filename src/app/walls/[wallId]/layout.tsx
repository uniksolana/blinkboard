import { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@/lib/supabase/server';

type Props = {
  params: Promise<{ wallId: string }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { wallId } = await params;
  const supabase = await createClient();

  const { data: wall } = await supabase
    .from('walls')
    .select('*')
    .eq('id', wallId)
    .single();

  if (!wall) {
    return {
      title: 'Muro no encontrado | BlinkBoard',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blinkboard-nu.vercel.app';
  // Use the image endpoint from the API action for the preview
  const imageUrl = `${baseUrl}/api/actions/blinkboard/${wallId}/image?t=${Date.now()}`;

  return {
    title: `${wall.name} | BlinkBoard`,
    description: `¡Anúnciate en este muro! Elige tu espacio, conéctate con X y paga en segundos con Solana.`,
    openGraph: {
      title: `${wall.name} | BlinkBoard`,
      description: `¡Anúnciate en este muro! Elige tu espacio, conéctate con X y paga en segundos con Solana.`,
      url: `${baseUrl}/walls/${wallId}`,
      siteName: 'BlinkBoard',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `Imagen del muro ${wall.name}`,
        },
      ],
      locale: 'es_ES',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${wall.name} | BlinkBoard`,
      description: `¡Anúnciate en este muro! Elige tu espacio, conéctate con X y paga en segundos con Solana.`,
      images: [imageUrl],
    },
    other: {
      // Solana Actions metadata
      'solana-action': `${baseUrl}/api/actions/blinkboard/${wallId}`,
    },
  };
}

export default function WallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
