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

export interface User {
	username: string,
	created_at: string,
	bookmarks: string[]
}

export interface UserRaw {
	username: string,
	created_at: string,
	bookmarks: string
}

export interface Comment {
	user_id: string,
	user_username: string,
	film_id: string,
	film_name: string,
	comment: string,
	date: string
}