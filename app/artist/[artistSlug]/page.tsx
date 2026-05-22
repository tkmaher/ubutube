import ArtistViewer from "@/components/content/artistViewer";
import "@/styles/content.scss";

export default async function Page({
    params,
}: {
    params: Promise<{ artistSlug: string }>;
}) {
    const { artistSlug } = await params;
    return (
        <ArtistViewer slug={artistSlug}/>
    );
}