export interface SearchResult {
	name: string,
	year: string,
	artist: string,
    id: string
}

export interface SearchTreeYear {
    year: string,
    children: SearchResult[] | SearchTreeArtist[]
}

export interface SearchTreeArtist {
    name: string,
    children: SearchResult[] | SearchTreeYear[],
}

export interface SearchTree {
    children: SearchTreeYear[] | SearchTreeArtist[]
}