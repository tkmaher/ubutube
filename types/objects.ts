export interface FilmSimpler {
	name: string,
	year?: string,
	id: string
}

export interface Film {
	name: string,
	artists: string[],
	description?: string,
	year?: string,
	ubuLink: string,
	src?: string,
	bySameArtist: FilmSimpler[],
	id: string
}

export interface Artist {
	name: string,
	description?: string,
	years?: string,
	ubuLink: string,
	bySameArtist: FilmSimpler[],
}