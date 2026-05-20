import FilmViewer from "@/components/content/filmViewer";
import "@/styles/content.scss";

export default async function Page({
    params,
}: {
    params: Promise<{ filmSlug: string }>;
}) {
    const { filmSlug } = await params;
    return (
        <FilmViewer slug={filmSlug}/>
    );
}