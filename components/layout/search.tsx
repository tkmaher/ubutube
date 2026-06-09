"use client";
import { SearchResult, SearchTree, SearchTreeArtist, SearchTreeYear } from "@/types/search";
import { useEffect, useMemo, useState } from "react";
import { GroupItem } from "@/components/layout/groupitem";
import { ReactLenis } from 'lenis/react'
import { useRouter } from "next/navigation";

const PER_PAGE = 50;

function buildTree(
    data: SearchResult[],
    priority: "artist" | "year",
    reverse: boolean,
    querying: boolean
): SearchTree {
    if (priority === "artist") {
        const grouped = data.reduce((acc, item) => {
            const year = item.year || "Undated";
            (acc[item.artist] ??= {})[year] ??= [];
            acc[item.artist][year].push(item);
            return acc;
        }, {} as Record<string, Record<string, SearchResult[]>>);

        let children: SearchTreeArtist[] = Object.entries(grouped).map(
            ([name, years]) => ({
                name,
                children: Object.entries(years).map(([year, children]) => ({
                    year,
                    children,
                })),
            })
        )

        if (!querying)
            children = children.sort((a, b) => a.name.localeCompare(b.name));

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
        )

        if (!querying)
            children.sort((a, b) => a.year.localeCompare(b.year));

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

    const [page, setPage] = useState(0);

    const router = useRouter();

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
        () => buildTree(rawResults, priority, reverse, searchQuery != ""),
        [rawResults, priority, reverse]
    );

    useEffect(() => {
        setPage(0);
    }, [searchResults, priority, reverse]);

    return (
        <div className="right-bar">

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
                        placeholder="Search catalog..."
                        value={searchQueryTmp}
                        onChange={e => setSearchQueryTmp(e.target.value)}
                        id="search"
                        aria-label="search input"
                        autoCorrect="off" 
                        autoCapitalize="off" 
                        spellCheck="false" 
                        autoComplete="off" 
                    />
                    <button type="submit" aria-label="Search">→</button>
                    <button onClick={() => {
                        const randomFilm = rawResults[Math.floor(Math.random() * rawResults.length)];
                        router.push(`/film/${randomFilm.id}`);
                    }}
                        type="button"
                        aria-label="Random film"
                    >
                        ?
                    </button>
                </form>

                <div className="search-row">
                    <button
                        onClick={() => 
                            setPriority(p => (p === "artist" ? "year" : "artist"))
                        }
                        className="sorter"
                        aria-label="List priority"
                    >
                        {priority === "artist" ? (
                            <>
                                Artist→Year
                            </>
                        ) : (
                            <>
                                Year→Artist
                            </>
                        )}
                    </button>
                    <button onClick={() => setReverse(r => !r)} className="orderer" aria-label="List precedence"> 
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

            <ReactLenis
                className="search-column"
                style={{ opacity: loading ? 0 : 1 }}
                options={{
                    lerp: 0.1,      
                    syncTouch: true,
                }}
            >
                {searchResults.children.length === 0 && <div className="tabs">(No results)</div>}
                {priority === "artist"
                    ? (searchResults.children as SearchTreeArtist[]).map(
                          (artistGroup, i) => (
                            (i >= PER_PAGE * page && i < PER_PAGE * (page+1)) && <GroupItem
                                  key={i}
                                  mode="artist"
                                  name={artistGroup.name}
                                  yearGroups={
                                      artistGroup.children as SearchTreeYear[]
                                  }
                                  query={searchQuery}
                              />
                            
                          )
                      )
                    : (searchResults.children as SearchTreeYear[]).map(
                          (yearGroup, i) => (
                            (i >= PER_PAGE * page && i < PER_PAGE * (page+1)) && <GroupItem
                                  key={i}
                                  mode="year"
                                  year={yearGroup.year}
                                  artistGroups={
                                      yearGroup.children as SearchTreeArtist[]
                                  }
                                  query={searchQuery}
                              />
                          )
                      )}
            </ReactLenis>

            <div className="search-form">
                <div className="search-row">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        aria-label="Back 1 page"
                    >
                        ←
                    </button>
                    <span style={{textAlign: "center"}}>
                        Page {page + 1} of{" "}
                        {Math.ceil(
                            searchResults.children.length / PER_PAGE
                        ) || 1}
                    </span>
                    <button
                        onClick={() =>
                            setPage(p =>
                                Math.min(p + 1, Math.ceil(searchResults.children.length / PER_PAGE) - 1)
                            )
                        }
                        disabled={
                            page >= Math.ceil(searchResults.children.length / PER_PAGE) - 1
                        }
                        aria-label="Forward 1 page"
                    >
                        →
                    </button>
                </div>
                
            </div>
        </div>
    );
}