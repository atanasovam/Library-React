import * as React from 'react';
import styled from 'styled-components';

import Web3Modal from 'web3modal';
// @ts-ignore
import WalletConnectProvider from '@walletconnect/web3-provider';
import Header from './components/Header';
import Loader from './components/Loader';
import ConnectButton from './components/ConnectButton';

import { Web3Provider } from '@ethersproject/providers';

import { getContract } from './helpers/ethers';

import { getChainData, showNotification } from './helpers/utilities';
import { ethers } from 'ethers';

import {
  LIBRARY_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_WRAPPER_ADDRESS
} from './constants';
import LIBRARY from './constants/abis/Library.json';
import LIB from './constants/abis/LIB.json';
import LIBWrapper from './constants/abis/LIBWrapper.json';

import { IAppState, IBookForm, IBook } from './interfaces/App-interfaces';
import * as appService from './services/app-service';

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: left;
`;

const CustomButton = styled.button`
  width: 100%;
  padding: 10px 7px;
  font-size: 16px;
  transition: all 0.5s;
  cursor: pointer;
  background-color: #28eb9b;
  border: 2px solid #28eb9b;
  color: white;
  font-weight: 600;

  &:hover {
    transition: all 0.5s;
    color: #28eb9b;
    background-color: transparent;
  }

  &:disabled {
    &:hover {
      background-color: #28eb9b;
      border: 2px solid #28eb9b;
      color: white;
    }
  }
`;

const TableRow = styled.div`
  margin-bottom: 1px;
  padding: 12px;
  font-size: 16px;
  transition: all 0.5s;
  cursor: pointer;
  background-color: #f0fcf9;
  border: 2px solid white;
  color: #0b5442;
  font-weight: 600;

  &:hover {
    transition: all 0.5s;
    color: #20b075;
    background-color: #e6f5f0;
  }
`;

const LongString = styled.p`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ScrollList = styled.div`
  max-height: 250px;
  overflow: scroll;
  overflow-x: hidden;
  overflow-y: auto;
`;

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  result: null,
  libraryContract: null,
  tokenContract: null,
  tokenWrapperContract: null,
  messageBarVisibility: "show",
  componentLoading: {
    availableBooks: true,
    borrowedBooks: true,
    createBook: true,
    buyLib: true
  },
  info: {
    error: '',
    message: '',
    loadingMsg: ''
  },
  createBookForm: {
    name: '',
    availableCopies: 0
  },
  buyLIBForm: {
    etherValue: 1
  },
  libraryBalance: 0,
  isAdmin: false,
  userBalance: 0,
  availableBooks: [],
  borrowedBooks: []
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions()
    });
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
  }

  public onConnect = async () => {
    const provider = await this.web3Modal.connect();
    const library = new Web3Provider(provider);
    const network = await library.getNetwork();

    const address = provider.selectedAddress ? provider.selectedAddress : provider?.accounts[0];

    const libraryContract = getContract(LIBRARY_ADDRESS, LIBRARY.abi, library, address);
    const tokenContract = getContract(TOKEN_ADDRESS, LIB.abi, library, address);
    const tokenWrapperContract = getContract(TOKEN_WRAPPER_ADDRESS, LIBWrapper.abi, library, address);

    const owner = await libraryContract.owner();
    const isAdmin = owner.toLowerCase() === address.toLowerCase();
    await this.setState({ isAdmin });

    await this.setState({
      provider,
      library,
      chainId: network.chainId,
      address,
      connected: true,
      libraryContract,
      tokenContract,
      tokenWrapperContract
    });

    await this.updateAvailableBooks();
    await this.updateBorrowedBooksByUser();
    await this.setLibraryBalance();
    await this.setUserBalance();

    await this.subscribeToProviderEvents(provider);
  };

  // contract methods
  public getAllBooks = async () => {
    const { libraryContract } = this.state;
    const booksCount = await libraryContract.viewAllBooksCount();

    if (!libraryContract) {
      return [];
    }

    const books = await appService.getAllBooks(libraryContract, booksCount);
    return books;
  };

  public getBooksCount = async () => {
    const { libraryContract } = this.state;

    if (!libraryContract) {
      return 0;
    }

    const count = await appService.getBooksCount(libraryContract);
    return count;
  };

  public createBook = async () => {
    this.setState({ componentLoading: { createBook: true } });

    const { libraryContract } = this.state;

    if (!libraryContract) {
      this.setState({ info: { error: "No library contract!" } });
      return;
    }
    const bookParams: IBookForm = this.state.createBookForm;

    if (bookParams.name.trim() === "") {
      await this.setState({ info: { error: "Book name should not be an empty string" } });
      return;
    }

    if (bookParams.availableCopies <= 0) {
      await this.setState({ info: { error: "Book copies should be more than 0!" } });
      return;
    }

    const response = await appService.createBook(libraryContract, bookParams);

    if (response.status !== 1) {
      await this.setState({ info: { error: response.message } });
      await this.setState({ messageBarVisibility: "show" });
      await this.setState({ componentLoading: { createBook: false } });

      return;
    }

    await this.updateAvailableBooks();

    this.state.createBookForm = {
      name: "",
      availableCopies: 0
    };

    await this.setState({ componentLoading: { createBook: false } });
  };

  public buyLIB = async (event: any) => {
    const { tokenWrapperContract } = this.state;
    const { etherValue } = this.state.buyLIBForm;

    if (!etherValue || !tokenWrapperContract) {
      return;
    }

    const wrapValue = ethers.utils.parseEther(etherValue.toString());
    const transactionResult = await appService.buyLib(tokenWrapperContract, wrapValue);

    if(transactionResult.status === 1) {
      await this.setLibraryBalance();
      await this.setUserBalance();
      // console.log('Balance: ', ethers.utils.formatEther(await this.state.tokenContract.balanceOf(this.state.address)))
      return;
    }
      
    await this.setState({ info: { error: transactionResult.message}});
    await this.setState({ componentLoading: { buyLIB: false } });
  };

  public borrowBook = async (event: any) => {
    const bookId = event.target.dataset.bookId;

    await this.approveTx();
    await this.setState({ componentLoading: { availableBooks: true } });

    const { libraryContract, availableBooks } = this.state;

    if (!libraryContract) {
      await this.setState({ info: { error: "No library contract!" } });
      await this.setState({ messageBarVisibility: "show" });
      return;
    }

    const transactionResult = await appService.borrowBook(libraryContract, availableBooks, bookId);

    if (transactionResult.status === 1) {
      await this.updateAvailableBooks();
      await this.updateBorrowedBooksByUser();

      await this.setState({ messageBarVisibility: "show" });

      await this.setState({ componentLoading: { availableBooks: false } });
      return;
    }

    await this.setState({ componentLoading: { availableBooks: false } });
    await this.setState({ info: { error: "Error borrowing book!" } });
    await this.setState({ messageBarVisibility: "show" });
  };

  public returnBook = async (event: any) => {
    this.setState({ componentLoading: { borrowedBooks: true } });

    const { libraryContract } = this.state;
    const bookId = event.target.dataset.bookId;

    if (!libraryContract) {
      await this.setState({ info: { error: "No library contract!" } });
      await this.setState({ messageBarVisibility: "show" });
      return;
    }

    const transactionResult = await appService.returnBook(libraryContract, bookId);

    if (transactionResult === 1) {
      await this.updateAvailableBooks();
      await this.updateBorrowedBooksByUser();

      await this.setState({ messageBarVisibility: "show" });
      await this.setState({ componentLoading: { availableBooks: false } });
      return;
    }

    await this.setState({ componentLoading: { availableBooks: false } });
    await this.setState({ info: { error: "Error returning book!" } });
    await this.setState({ messageBarVisibility: "show" });
  };

  public setUserBalance = async () => {
    const { tokenContract, address } = this.state;

    const userRawBalance = await tokenContract.balanceOf(address);
    const userBalance = ethers.utils.formatEther(userRawBalance);

    await this.setState({ userBalance });
  };

  public setLibraryBalance = async () => {
    const { tokenContract, library } = this.state;
    
    if (!library) {
      return;
    }

    const contractTOKENBalance = await tokenContract.balanceOf(LIBRARY_ADDRESS);
    const libraryBalance = ethers.utils.formatEther(contractTOKENBalance);

    await this.setState({ libraryBalance });
  };

  public approveTx = async () => {
    const bookPrice = ethers.utils.parseEther("1").toString();
    const { tokenContract } = this.state;

    await this.setState({ componentLoading: { availableBooks: true } });

    const transactionReceipt = await appService.approveBorrow(tokenContract, LIBRARY_ADDRESS, bookPrice);

    if (transactionReceipt.status === 1) {
      await this.setState({ componentLoading: { availableBooks: false } });
      await this.updateAvailableBooks();
      return;
    }

    await this.setState({ componentLoading: { availableBooks: false } });
    await this.setState({ info: { error: transactionReceipt.message } });
  }

  public approveWithdraw = async (value: any) => {
    const amount = ethers.utils.parseEther(value.toString()).toString();
    const { tokenContract } = this.state;

    await this.setState({ componentLoading: { buyLIB: true } });
    const transactionReceipt = await appService.approveBorrow(tokenContract, TOKEN_WRAPPER_ADDRESS, amount);

    if (transactionReceipt.status === 1) {
      await this.setState({ componentLoading: { buyLIB: false } });
      await this.setLibraryBalance();
      await this.setUserBalance();
      return;
    }

    await this.setState({ componentLoading: { buyLIB: false } });
    await this.setState({ info: { error: transactionReceipt.message } });
  };

  public withdrawUserBalance = async () => {
    const { tokenWrapperContract } = this.state;

    await this.approveWithdraw(1);
    await this.setState({ componentLoading: { buyLib: true } });

    const transactionReceipt = await appService.unwrapToken(tokenWrapperContract, '1');

    if (transactionReceipt.status === 1) {
      await this.setState({ componentLoading: { buyLib: false } });
      await this.setLibraryBalance();
      await this.setUserBalance();
      return;
    }

    await this.setState({ componentLoading: { buyLib: false } });
    await this.setState({ info: { error: transactionReceipt.message } });
  }

  public withdrawLibraryBalance = async () => {
    const { libraryContract } = this.state;
    await this.setState({ componentLoading: { buyLib: true } });

    const transactionReceipt = await appService.withdrawLibraryBalance(libraryContract);
    console.log(transactionReceipt);

    if (transactionReceipt.status === 1) {
      await this.setState({ componentLoading: { buyLib: false } });
      await this.setLibraryBalance();
      await this.setUserBalance();
      return;
    }

    await this.setState({ componentLoading: { buyLib: false } });
    await this.setState({ info: { error: transactionReceipt.error?.message?.split(': ')[1] } });
  }
  // contract methods end

  public subscribeToProviderEvents = async (provider: any) => {
    const { libraryContract, tokenWrapperContract } = this.state;
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);

    libraryContract.on("LogAddedBook", this.handleAddedBookEvent);
    libraryContract.on("BookBorrowed", this.handleBookBorrowedEvent);
    libraryContract.on("BookReturned", this.handleBookReturnedEvent);
    tokenWrapperContract.on("LogLIBUnwrapped", this.handleUnwrap);

    await this.web3Modal.off('accountsChanged');
  };

  public async unSubscribe(provider: any) {
    const { libraryContract } = this.state;
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);

    libraryContract.on("LogAddedBook", this.handleAddedBookEvent);
    libraryContract.on("BookBorrowed", this.handleBookBorrowedEvent);
    libraryContract.on("BookReturned", this.handleBookReturnedEvent);
  };

  public handleAddedBookEvent = (bookId: any) => {
    showNotification(`Created book with id: ${bookId}`);
  }

  public handleBookBorrowedEvent = (bookId: any) => {
    showNotification(`Borrowed book with id: ${bookId}`);
  }

  public handleUnwrap = (address: string, value: any) => {
    console.log(address)
    console.log(value)
    showNotification(`Library balance: ${value}`);
  }

  public handleBookReturnedEvent = (bookId: any) => {
    showNotification(`Returned book with id: ${bookId}`);
  }

  public changedAccount = async (accounts: string[]) => {
    if (!accounts.length) {
      // Metamask Lock fire an empty accounts array 
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
    }
  };

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });
  };

  public close = async () => {
    this.resetApp();
  };

  public getNetwork = () => getChainData(this.state.chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID
        }
      }
    };
    return providerOptions;
  };

  public resetApp = async () => {
    await this.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(this.provider);

    this.setState({ ...INITIAL_STATE });

  };

  public handleInputChange = async (event: any) => {
    const { name, value } = event.target;
    const { form } = event.currentTarget;
    const id = form.id;
    
    if (id === "createBookForm") {
      await this.setState({
        createBookForm: {
          ...this.state.createBookForm,
          [name]: value
        }
      });
      return;
    }

    await this.setState({
      buyLIBForm: {
        ...this.state.buyLIBForm,
        [name]: value
      }
    });
  };

  // Borrow 
  public updateBorrowedBooksByUser = async () => {
    await this.setState({ componentLoading: { borrowedBooks: true } });

    const borrowedBooks: IBook[] = await this.getBorrowedBooksByUser();

    await this.setState({ borrowedBooks });
    await this.setState({ componentLoading: { borrowedBooks: false } });
  };

  public getBorrowedBooksByUser = async () => {
    await this.setState({ componentLoading: { borrowedBooks: true } });

    const { libraryContract, address } = this.state;

    if (!(libraryContract || address)) {
      return [];
    }

    const allBooks = await this.getAllBooks();
    const borrowedBooks = [];

    let currentBook;
    let isBorrowed;

    for (let i = 0; i < allBooks.length; i++) {
      currentBook = allBooks[i];
      isBorrowed = await appService.isBookBorrowedByUser(libraryContract, address, currentBook.id);

      if (isBorrowed) {
        borrowedBooks.push(currentBook);
      }
    }

    return borrowedBooks;
  };

  // Available books
  public updateAvailableBooks = async () => {
    await this.setState({ componentLoading: { availableBooks: true } });

    const books: IBook[] = await this.getAllBooks();
    const availableBooks: IBook[] = appService.getAvailableBooks(books);

    await this.setState({ availableBooks });
    await this.setState({ componentLoading: { availableBooks: false } });
  };

  // create html components
  public createBorrowedBooksList = () => {
    const { borrowedBooks } = this.state;

    if (borrowedBooks.length === 0) {
      return <TableRow className="alert alert-warning" role="alert">No borrowed books!</TableRow>;
    }

    const list = [];
    let currentBook: IBook;

    for (let i = 0; i < borrowedBooks.length; i++) {
      currentBook = borrowedBooks[i];

      list.push(
        <TableRow className="row pt-3" key={'borrowed-books-' + currentBook.id}>
          <div className="col-4 my-auto">
            <LongString>{currentBook.id}</LongString></div>
          <div className="col-4 my-auto">{currentBook.name}</div>
          <div className="col-4 my-auto">
            <CustomButton onClick={this.returnBook} disabled={false} data-book-id={currentBook.id}>Return</CustomButton>
          </div>
        </TableRow>
      );
    }

    if (list.length === 0) {
      return <TableRow className="alert alert-warning" role="alert">No borrowed books!</TableRow>;
    }

    return list;
  };

  public createAvailableBooksList = () => {
    const { availableBooks } = this.state;

    if (availableBooks.length === 0) {
      return <TableRow className="alert alert-warning" role="alert">No available books!</TableRow>;
    }

    const list = [];
    let currentBook: IBook;

    for (let i = 0; i < availableBooks.length; i++) {
      currentBook = availableBooks[i];

      list.push(
        <TableRow className="row pt-3" key={'available-books-' + currentBook.id}>
          <div className="col-4 my-auto">{currentBook.name}</div>
          <div className="col-4 my-auto">{currentBook.availableCopies}</div>
          <div className="col-4 my-auto">
            <CustomButton onClick={this.borrowBook} disabled={false} data-book-id={currentBook.id}>Borrow</CustomButton>
          </div>
        </TableRow>
      );
    }

    if (availableBooks.length === 0) {
      return <TableRow className="alert alert-warning" role="alert">No available books!</TableRow>;
    }

    return list;
  };
  // create html components end

  public changeMessageBarVisibility = async () => {
    const { messageBarVisibility } = this.state;

    await this.setState({ "messageBarVisibility": messageBarVisibility === "hide" ? "show" : "hide" });

    setTimeout(async () => {
      await this.setState({
        info: {
          error: '',
          message: '',
          loading: '',
        }
      });
    }, 500);

  }

  // render methods
  public renderCreateBookForm = () => {
    const { componentLoading } = this.state;

    return (
      <div className="col-3">
        <div className="row">
          <div className="col-12">

            <h4>Create book</h4>
            <form id="createBookForm" action="">
              <div className="form-group mt-1">
                <label className="form-label d-block">Book name</label>
                <input disabled={componentLoading.createBook} value={this.state.createBookForm.name || ''} onChange={this.handleInputChange} className="form-control" type="text" name="name" />
              </div>

              <div className="form-group mt-1">
                <label className="form-label d-block">Copies count</label>
                <input disabled={componentLoading.createBook} value={this.state.createBookForm.availableCopies || ''} onChange={this.handleInputChange} className="form-control" type="number" name="availableCopies" />
              </div>

              <div>
                <CustomButton disabled={componentLoading.createBook} type="button" onClick={this.createBook}>Create book</CustomButton>
              </div>
            </form>
          </div>
        </div>

        {componentLoading.createBook
          ? (
            <div className="row">
              {this.renderLoader()}
            </div>
          )
          : null}
      </div>
    );
  };

  public renderAvailableBooksList = () => {
    const { componentLoading } = this.state;

    return (
      <div>
        <h4>Available books</h4>

        <div className="row pb-2">
          <div className="col-4">Name</div>
          <div className="col-4">Copies</div>
          <div className="col-4" />
        </div>

        <ScrollList className="inner-scrollbar">
          {componentLoading.availableBooks
            ? this.renderLoader()
            : this.createAvailableBooksList()}
        </ScrollList>
      </div>
    );
  };

  public renderBorrowedBooksList = () => {
    const { componentLoading } = this.state;

    return (
      <div>
        <h4>Borrowed books</h4>
        <div className="row pb-2">
          <div className="col-4">ID</div>
          <div className="col-4" >Name</div>
          <div className="col-4" />
        </div>

        <ScrollList className="inner-scrollbar">
          {componentLoading.borrowedBooks
            ? this.renderLoader()
            : this.createBorrowedBooksList()
          }
        </ScrollList>
      </div>
    );
  };

  public renderLIBDetails = () => {
    const {
      libraryBalance,
      componentLoading,
      userBalance
    } = this.state;

    return (
      <div className="col-3">
        <div>
          <h4>Buy LIB</h4>
          <form id="buyLIBForm" action="">
            <div className="form-group mt-1">
              <label className="form-label d-block">Ethereum Amount</label>
              <input value={this.state.buyLIBForm.etherValue || ''} onChange={this.handleInputChange} className="form-control" type="number" name="etherValue" />
            </div>

            <div>
              <CustomButton type="button" onClick={this.buyLIB}>Buy LIB</CustomButton>
            </div>
          </form>

          {componentLoading.buyLib
            ? (
              <div className="row">
                {this.renderLoader()}
              </div>
            )
            : null}
        </div>

        <div className="pt-4">
          <h5>Library Balance: {libraryBalance}LIB</h5>
          <h5>User Balance: {userBalance}LIB</h5>

          <div>
            <CustomButton type="button" onClick={this.withdrawUserBalance}>Withdraw 1LIB</CustomButton>
          </div>

          <div className="pt-4">
            <CustomButton type="button" onClick={this.withdrawLibraryBalance}>Withdraw Library Balance</CustomButton>
          </div>
        </div>

      </div>
    );
  };

  public renderHomeScreen = () => {
    const {
      info,
      isAdmin
    } = this.state;

    return (
      <div>
        <div className="row">
          <div className="col-6 mx-auto">
            {info.error && info.error !== '' ? this.renderErrorMessageBar() : null}
            {info.message && info.message !== '' ? this.renderNotificationBar() : null}
          </div>
        </div>

        <div className="row px-3">

          <div className="col-4">
            {this.renderAvailableBooksList()}
            {this.renderBorrowedBooksList()}
          </div>

          {isAdmin ? this.renderCreateBookForm() : null}

          {this.renderLIBDetails()}

        </div>
      </div>
    );
  };

  public renderLoader = () => {
    return (
      <div className="col-2 mx-auto pt-4"><Loader /></div>
    );
  };

  public renderErrorMessageBar = () => {
    const {
      info,
      messageBarVisibility
    } = this.state;

    const classNameList = `alert alert-danger alert-dismissible fade mx-auto ${messageBarVisibility}`;

    return (
      <div className={classNameList} role="alert">
        <LongString>{info.error}</LongString>
        <button type="button" className="close" data-dismiss="alert" aria-label="Close" onClick={this.changeMessageBarVisibility}>
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    );
  };

  public renderNotificationBar = () => {
    const {
      info,
      messageBarVisibility
    } = this.state;

    const classNameList = `alert alert-success alert-dismissible fade mx-auto ${messageBarVisibility}`;

    return (
      <div className={classNameList} role="alert">
        <LongString>{info.message}</LongString>
        <button type="button" className="close" data-dismiss="alert" aria-label="Close" onClick={this.changeMessageBarVisibility}>
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    );
  };

  public render = () => {
    const {
      address,
      connected,
      chainId,
      fetching
    } = this.state;

    return (
      <SLayout>
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <Header connected={connected} address={address} chainId={chainId} killSession={this.resetApp} />
            </div>
          </div>

          {fetching
            ? this.renderLoader()
            : connected ? this.renderHomeScreen()
              : (
                <div className="col-4 mx-auto">
                  {!this.state.connected && <ConnectButton onClick={this.onConnect} />}
                </div>
              )
          }

        </div>
      </SLayout>
    );
  };
}

export default App;
