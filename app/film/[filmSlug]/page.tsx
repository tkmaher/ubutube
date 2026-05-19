import FilmViewer from "@/components/content/filmViewer";

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