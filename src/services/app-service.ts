import { IBook, IBookForm } from '../interfaces/App-interfaces';
import { ethers } from 'ethers';

const createBook = async (contract: any, bookParams: IBookForm): Promise<any> => {
    try {
        const createBookTransactionReceipt = await contract.createBook(bookParams.availableCopies, bookParams.name);
        const transactionResult = await createBookTransactionReceipt.wait();

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

const approveBorrow = async (contract: any, address: string, bookPrice: string): Promise<any> => {
    try {
        const transaction = await contract.approve(address, bookPrice);
        const transactionReceipt = await transaction.wait();

        return Promise.resolve(transactionReceipt);
    } catch (error) {
        return Promise.resolve(error);
    }
};

const withdrawBalance = async (contract: any, value: any): Promise<any> => {
    try {
        const transaction = await contract.unwrap({ value });
        const transactionReceipt = await transaction.wait();

        return Promise.resolve(transactionReceipt);
    } catch (error) {
        return Promise.resolve(error);
    }
};

const withdrawLibraryBalance = async (contract: any) => {
    try {
        const transaction = await contract.withdrawLibraryBalance();
        const transactionReceipt = await transaction.wait();

        return Promise.resolve(transactionReceipt);
    } catch (error) {
        return Promise.resolve(error);
    }
};

const buyLib = async (contract: any, wrapValue: any) => {
    try {    
        const wrapTx = await contract.wrap({ value: wrapValue });
        const transactionResult = await wrapTx.wait();

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

const unwrapToken = async (contract: any, value: any) => {
    try {
        value = ethers.utils.parseEther(value);
        const tx = await contract.unwrap(value);
        const transactionReceipt = await tx.wait();

        return Promise.resolve(transactionReceipt);
    } catch (error) {
        return Promise.resolve(error);
    }
};

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
    approveBorrow,
    returnBook,
    getBooksCount,
    getAllBooks,
    getAvailableBooks,
    isBookAvailable,
    isBookBorrowedByUser,
    withdrawBalance,
    buyLib,
    unwrapToken,
    withdrawLibraryBalance
}