export interface FilmSimpler {
	name: string,
	year?: string
}

export interface Film {
	name: string,
	artists: string[],
	description?: string,
	year?: string,
	ubuLink: string,
	src?: string,
	bySameArtist: FilmSimpler[]
}

export interface Artist {
	name: string,
	description?: string,
	years?: string,
	ubuLink: string,
	bySameArtist: FilmSimpler[]
}