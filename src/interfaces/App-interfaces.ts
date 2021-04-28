export interface IBookForm {
    name: string;
    availableCopies: number;
}

export interface IBuyLIBForm {
    etherValue: number;
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
    tokenContract: any | null;
    tokenWrapperContract: any | null;
    messageBarVisibility: "hide" | "show",
    componentLoading: {
        availableBooks: boolean,
        buyLib: boolean,
        borrowedBooks: boolean,
        createBook: boolean
    },
    info: IInfo;
    createBookForm: IBookForm;
    buyLIBForm: IBuyLIBForm;
    borrowedBooks: any[];
    availableBooks: IBook[];
    libraryBalance: number;
    userBalance: number;
    isAdmin: boolean;
}
