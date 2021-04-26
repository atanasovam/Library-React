export interface IBookForm {
    name: string;
    availableCopies: number;
}

export interface IBook {
    id: string;
    name: string;
    availableCopies: number;
}

export interface IInfo {
    error: string;
    message: string;
    loadingMsg: string;
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
    componentLoading: {
        availableBooks: boolean,
        borrowedBooks: boolean,
        createBook: boolean
    },
    info: IInfo;
    form: IBookForm;
    borrowedBooks: any[];
    availableBooks: IBook[];
}
