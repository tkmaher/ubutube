import { cache } from "react";
import { Metadata } from "next";
import { User, UserRaw } from "@/types/objects";
import FilmViewer from "@/components/content/filmViewer"; 
import "@/styles/content.scss";
import UserViewer from "@/components/content/userViewer";

const getUserData = cache(async (userSlug: string): Promise<User | null> => {
    const res = await fetch(
        `https://ubu-worker.tomaszkkmaher.workers.dev/api/users/${userSlug}`
    );
    const data: { cached: boolean; user: UserRaw; success: boolean } = await res.json();

    if (!data.success || !data.user) return null; // ✅ guard before touching data.user

    return {
        ...data.user,
        bookmarks: data.user.bookmarks ? data.user.bookmarks.split(',') : [],
    };
});

export async function generateMetadata(
    { params }: { params: Promise<{ userSlug: string }> }
): Promise<Metadata> {
    const { userSlug } = await params;
    const user = await getUserData(userSlug);
    return {
        title: user?.username ?? "User not found",
    };
}

export default async function UserPage({ params }: { params: Promise<{ userSlug: string }>;
}) {
    const { userSlug } = await params;
    const user = await getUserData(userSlug);
    return <UserViewer slug={userSlug} initialData={user} />;
}