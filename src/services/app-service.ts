import { IBook, IBookForm } from '../interfaces/App-interfaces';

const createBook = async (contract: any, bookParams: IBookForm) => {
    const createBookTransactionReceipt = await contract.createBook(bookParams.availableCopies, bookParams.name);
    const response = await createBookTransactionReceipt.wait();
    return response.status;
    // if (response.status !== 1) {
    //     // console.log("Transaction was not successful!");
    //     return response.status;
    // }

    // console.log("Transaction successful!");
};

const borrowBook = async (contract: any, availableBooks: any, bookId: any) => {
    // console.log(`Borrowing book with id: ${bookId}...`);
    if (availableBooks.length === 0) {
        // console.log(`Cannot borrow book with id: ${bookId}- no available copies!`);
        return;
    }

    try {
        const borrowBookTransactionReceipt = await contract.borrowBook(bookId);
        await borrowBookTransactionReceipt.wait();
        // console.log("Transaction was successful!\n");
    } catch (response) {
        if (response.status !== 1) {
            // console.log("Transaction was not successful!\n");
        }
    }
};

const returnBook = async (contract: any, bookId: any) => await contract.returnBook(bookId);

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

const isBookBorrowedByUser = async (contract: any, wallet: any, bookId: any) => await contract.borrowedBooks(wallet.address, bookId);

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