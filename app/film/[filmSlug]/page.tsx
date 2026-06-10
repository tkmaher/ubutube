import { cache } from "react";
import { Metadata } from "next";
import { Film } from "@/types/objects";
import FilmViewer from "@/components/content/filmViewer"; 
import "@/styles/content.scss";

const getFilmData = cache(async (filmSlug: string): Promise<Film | null> => {
    const res = await fetch(
        `https://api.ubutube.org/api/films/${filmSlug}`,
        {next: { revalidate: 86400 }} 
    );
    const data: { cached: boolean; film: Film; success: boolean } = await res.json();
    return data.success ? data.film : null;
});

export async function generateMetadata(
    { params }: { params: Promise<{ filmSlug: string }> }
): Promise<Metadata> {
    const { filmSlug } = await params;
    const film = await getFilmData(filmSlug);
    return {
        title: film?.name ?? "Film not found",
    };
}

export default async function FilmPage({ params }: { params: Promise<{ filmSlug: string }>;
}) {
    const { filmSlug } = await params;
    const film = await getFilmData(filmSlug);
    return <FilmViewer slug={filmSlug} initialData={film} />;
}