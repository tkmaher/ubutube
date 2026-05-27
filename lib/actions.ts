"use server";
import { revalidateTag } from "next/cache";

export async function revalidateUserCache(userSlug: string) {
    revalidateTag(`user-${userSlug}`, "default");
}