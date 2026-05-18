"use client";
import Image from "next/image";
import { SearchResult, SearchTree, SearchTreeArtist, SearchTreeYear } from "@/types/search";
import { useEffect, useMemo, useState } from "react";
import { GroupItem } from "@/components/layout/groupitem";

function buildTree(
    data: SearchResult[],
    priority: "artist" | "year",
    reverse: boolean
): SearchTree {
    if (priority === "artist") {
        const grouped = data.reduce((acc, item) => {
            const year = item.year || "Undated";
            (acc[item.artist] ??= {})[year] ??= [];
            acc[item.artist][year].push(item);
            return acc;
        }, {} as Record<string, Record<string, SearchResult[]>>);

        const children: SearchTreeArtist[] = Object.entries(grouped).map(
            ([name, years]) => ({
                name,
                children: Object.entries(years).map(([year, children]) => ({
                    year,
                    children,
                })),
            })
        );

        return { children: reverse ? children.reverse() : children };
    } else {
        const grouped = data.reduce((acc, item) => {
            const year = item.year || "Unknown";
            (acc[year] ??= {})[item.artist] ??= [];
            acc[year][item.artist].push(item);
            return acc;
        }, {} as Record<string, Record<string, SearchResult[]>>);

        const children: SearchTreeYear[] = Object.entries(grouped).map(
            ([year, artists]) => ({
                year,
                children: Object.entries(artists).map(([name, children]) => ({
                    name,
                    children,
                })),
            })
        );

        return { children: reverse ? children.reverse() : children };
    }
}

export default function Search() {
    const [searchQueryTmp, setSearchQueryTmp] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [priority, setPriority] = useState<"artist" | "year">("artist");
    const [reverse, setReverse] = useState(false);
    const [rawResults, setRawResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(
            `https://ubu-worker.tomaszkkmaher.workers.dev/api/search?${new URLSearchParams(
                { queryString: searchQuery }
            )}`
        )
            .then(res => res.json())
            .then(
                (data: {
                    cached: boolean;
                    searchResults: SearchResult[];
                    success: boolean;
                }) => {
                    if (data.success) setRawResults(data.searchResults);
                    else console.error("Search API error:", data);
                }
            )
            .catch(err => console.error("Search fetch error:", err))
            .finally(() => setLoading(false));
    }, [searchQuery]);

    const searchResults = useMemo(
        () => buildTree(rawResults, priority, reverse),
        [rawResults, priority, reverse]
    );

    return (
        <div className="left-bar">
            <div className="logo">
                <Image src="/spirale.png" height={50} width={50} alt="UbuTube logo" />
                <div>UbuTube</div>
            </div>

            

            <div
                className="search-column"
                style={{ opacity: loading ? 0 : 1 }}
            >
                {searchResults.children.length === 0 && "(No results)"}
                {priority === "artist"
                    ? (searchResults.children as SearchTreeArtist[]).map(
                          (artistGroup, i) => (
                              <GroupItem
                                  key={i}
                                  mode="artist"
                                  name={artistGroup.name}
                                  yearGroups={
                                      artistGroup.children as SearchTreeYear[]
                                  }
                              />
                          )
                      )
                    : (searchResults.children as SearchTreeYear[]).map(
                          (yearGroup, i) => (
                              <GroupItem
                                  key={i}
                                  mode="year"
                                  year={yearGroup.year}
                                  artistGroups={
                                      yearGroup.children as SearchTreeArtist[]
                                  }
                              />
                          )
                      )}
            </div>
            {loading && <div
                className="search-column"
                style={{ opacity: loading ? 1 : 0 }}
            >
                {loading && "Loading..."}
            </div>}

            <div className="search-form">
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        if (!loading) setSearchQuery(searchQueryTmp);
                    }}
                    className="search-row"
                >
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQueryTmp}
                        onChange={e => setSearchQueryTmp(e.target.value)}
                        id="search"
                        aria-label="search input"
                    />
                    <button type="submit">→</button>
                </form>

                <div className="search-row">
                    <button
                        onClick={() =>
                            setPriority(p => (p === "artist" ? "year" : "artist"))
                        }
                        className="sorter"
                    >
                        {priority === "artist" ? (
                            <>
                                <b>Artist</b> / Year
                            </>
                        ) : (
                            <>
                                Artist / <b>Year</b>
                            </>
                        )}
                    </button>
                    <button onClick={() => setReverse(r => !r)} className="orderer">
                        {reverse
                            ? priority === "artist"
                                ? "Z→A"
                                : "Newest→Oldest"
                            : priority === "artist"
                            ? "A→Z"
                            : "Oldest→Newest"}
                    </button>
                </div>
            </div>
        </div>
    );
}