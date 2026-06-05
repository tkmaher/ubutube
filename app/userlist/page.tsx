import { cache } from "react";
import { Metadata } from "next";
import { UserList } from "@/types/objects";
import UserListViewer from "@/components/content/userList";
import "@/styles/content.scss";

const getUserList = cache(async (page: number, order: string): Promise<UserList | null> => {
    const res = await fetch(
        `https://ubu-worker.tomaszkkmaher.workers.dev/api/userList?page=${page}&order=${order}`,
        { next: { tags: [`userList-${page}-${order}`] } }
    );
    console.log(`Fetching user list for page ${page} and order ${order}. Status: ${res.status}`);
    const data: { 
        cached: boolean; 
        userList: UserList; 
        success: boolean 
    } = await res.json();

    console.log("got:", data);

    if (!data.success || !data.userList) return null; 

    return data.userList;
});

export async function generateMetadata(
    { params }: { params: Promise<{ page: number, order: string }> }
): Promise<Metadata> {
    const { page } = await params;
    return {
        title: `Userlist | Page ${page ?? 1}`
    };
}

export default async function UserPage({ searchParams }: { searchParams: Promise<{ page: number, order: string }>;
}) {
    const { page, order } = await searchParams;
    console.log(`Generating user list page for page ${page} and order ${order}`);
    const userList = await getUserList(page ?? 1, order ?? "asc");
    return <UserListViewer initialData={userList} page={page ?? 1} order={order ?? "asc"} />;
}