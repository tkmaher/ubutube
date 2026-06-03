import ArtistViewer from "@/components/content/artistViewer";
import "@/styles/content.scss";
import { cache } from "react";
import { Metadata } from "next";
import { Artist } from "@/types/objects";

const getArtistData = cache(async (artistSlug: string): Promise<Artist | null> => {
    const res = await fetch(
        `https://ubu-worker.tomaszkkmaher.workers.dev/api/artists/${artistSlug}`
        );
        const data: { cached: boolean; artist: Artist; success: boolean } = await res.json();
    return data.success ? data.artist : null;
});

export async function generateMetadata(
    { params }: { params: Promise<{ artistSlug: string }> }
): Promise<Metadata> {
    const { artistSlug } = await params;
    const artist = await getArtistData(artistSlug);
    return {
        title: artist?.name ?? "Artist not found",
    };
}

export default async function Page({
    params,
}: {
    params: Promise<{ artistSlug: string }>;
}) {
    const { artistSlug } = await params;
    const artist = await getArtistData(artistSlug);
    return (
        <ArtistViewer slug={artistSlug} initialData={artist}/>
    );
}