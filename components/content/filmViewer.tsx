"use client";

export default function FilmViewer({slug}: {slug: string}) {
    const decodedSlug = decodeURIComponent(slug);

    return (
        <div className="viewer-column">
            Film: {decodedSlug}
        </div>
    );
}