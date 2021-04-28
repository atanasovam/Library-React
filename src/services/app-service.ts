import { IBook, IBookForm } from '../interfaces/App-interfaces';

const createBook = async (contract: any, bookParams: IBookForm): Promise<any> => {
    try {
        const createBookTransactionReceipt = await contract.createBook(bookParams.availableCopies, bookParams.name);
        const transactionResult = await createBookTransactionReceipt.wait();

        if (transactionResult.status === 1) {
            return Promise.resolve(transactionResult);
        }

        return Promise.resolve(transactionResult);
    } catch (response) {
        return Promise.resolve(response);
    }
};

const borrowBook = async (contract: any, availableBooks: any, bookId: string): Promise<any> => {
    if (availableBooks.length === 0) {
        return Promise.resolve({ response: 0 });
    }

    try {
        const borrowBookTransactionReceipt = await contract.borrowBook(bookId);
        const transactionResult = await borrowBookTransactionReceipt.wait();

        return Promise.resolve(transactionResult);
    } catch (response) {
        return Promise.resolve(response);
    }
};

const returnBook = async (contract: any, bookId: string): Promise<number> => {
    if (bookId === "") {
        return Promise.resolve(0);
    }

    try {
        const returnBookTransactionReceipt = await contract.returnBook(bookId);
        const transactionResult = await returnBookTransactionReceipt.wait();

        if (transactionResult.status === 1) {
            return Promise.resolve(1);
        }

        return Promise.resolve(0);
    } catch (response) {
        return Promise.resolve(0);
    }
}

const getBooksCount = async (contract: any): Promise<number> => {
    const booksCount = await contract.viewAllBooksCount();
    return parseInt(booksCount, 10);
};

const getAvailableBooks = (allBooks: any[]): IBook[] => allBooks.filter((book: IBook) => book.availableCopies > 0);

const getAllBooks = async (contract: any, booksCount: number): Promise<IBook[]> => {
    const allBooks = [];
    let book;
    let id;

    for (let i = 0; i < booksCount; i++) {
        id = await contract.allBookIDs(i);
        const { name, availableCopiesCount } = await contract.books(id);

        book = {
            id,
            name,
            availableCopies: parseInt(availableCopiesCount, 10)
        };

        allBooks.push(book);
    }

    return allBooks;
};

const isBookAvailable = async (contract: any, bookId: any) => {
    const { availableCopiesCount } = await contract.books(bookId);
    return availableCopiesCount > 0;
};

const isBookBorrowedByUser = async (contract: any, address: any, bookId: any) => await contract.borrowedBooks(address, bookId);

export {
    createBook,
    borrowBook,
    returnBook,
    getBooksCount,
    getAllBooks,
    getAvailableBooks,
    isBookAvailable,
    isBookBorrowedByUser
}