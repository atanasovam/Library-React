export interface IBooks {
    booksCount: number;
}

export interface IBookForm {
    name: string;
    copiesCount: number;
}

export interface IAppState {
    fetching: boolean;
    address: string;
    library: any;
    connected: boolean;
    chainId: number;
    pendingRequest: boolean;
    result: any | null;
    libraryContract: any | null;
    info: any | null;
    books: IBookForm;
}
