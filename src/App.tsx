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
import { getChainData } from './helpers/utilities';

import { LIBRARY_ADDRESS } from './constants';
import LIBRARY from './constants/abis/Library.json';

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

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  result: null,
  libraryContract: null,
  componentLoading: {
    availableBooks: true,
    borrowedBooks: true,
    createBook: true
  },
  info: {
    error: '',
    message: '',
    loadingMsg: ''
  },
  form: {
    name: '',
    availableCopies: 0
  },
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

    await this.setState({
      provider,
      library,
      chainId: network.chainId,
      address,
      connected: true,
      libraryContract
    });

    await this.updateAvailableBooks();
    await this.updateBorrowedBooksByUser();

    await this.subscribeToProviderEvents(provider);
  };

  public subscribeToProviderEvents = async (provider: any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);

    await this.web3Modal.off('accountsChanged');
  };

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
    const { libraryContract } = this.state;

    if (!libraryContract) {
      return;
    }

    const bookParams: IBookForm = this.state.form;
    const response = await appService.createBook(libraryContract, bookParams);

    if(response !== 1) {
      await this.setState({info: { message: "Cannot create book!"}});
      return;
    }

    await this.updateAvailableBooks();
    await this.setState({info: { message: "Created book!"}});
  };

  public borrowBook = async (event: any) => {
    this.setState({ componentLoading: { availableBooks: true } });

    const { libraryContract, availableBooks } = this.state;
    const bookId = event.target.dataset.bookId;

    if (!libraryContract) {
      return;
    }

    const transactionResult = await appService.borrowBook(libraryContract, availableBooks, bookId);

    if(transactionResult === 1) {
      await this.updateAvailableBooks();
      await this.updateBorrowedBooksByUser();
      
      this.setState({ componentLoading: { availableBooks: false } });
    }
  };

  public returnBook = async (event: any) => {
    this.setState({ componentLoading: { borrowedBooks: true } });

    const { libraryContract } = this.state;
    const bookId = event.target.dataset.bookId;

    if (!libraryContract) {
      return;
    }

    const transactionResult = await appService.returnBook(libraryContract, bookId);

    if(transactionResult === 1) {
      await this.updateAvailableBooks();
      await this.updateBorrowedBooksByUser();
      
      this.setState({ componentLoading: { availableBooks: false } });
    }
  };

  public async unSubscribe(provider: any) {
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);
  };

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
    await this.setState({ form: { ...this.state.form, [name]: value } });
  };

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
        <TableRow className="row pt-3">
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

  public updateAvailableBooks = async () => {
    await this.setState({ componentLoading: { availableBooks: true } });

    const books: IBook[] = await this.getAllBooks();
    const availableBooks: IBook[] = appService.getAvailableBooks(books);

    await this.setState({ availableBooks });
    await this.setState({ componentLoading: { availableBooks: false } });
  };

  public createAvailableBooksList = () => {
    const { availableBooks } = this.state;
    const list = [];
    let currentBook: IBook;

    for (let i = 0; i < availableBooks.length; i++) {
      currentBook = availableBooks[i];

      list.push(
        <TableRow className="row pt-3">
          <div className="col-5 my-auto">{currentBook.name}</div>
          <div className="col-2 my-auto">{currentBook.availableCopies}</div>
          <div className="col-5 my-auto">
            <CustomButton onClick={this.borrowBook} disabled={false} data-book-id={currentBook.id}>Borrow</CustomButton>
          </div>
        </TableRow>
      );
    }

    return list;
  };

  public renderHomeScreen = () => {
    const {
      componentLoading
    } = this.state;

    return (
      <div>
        {this.state.info.message ?
          (<div className="row">
            <div className="col-6 mx-auto">
              {this.renderNotificationBar()}
            </div>
          </div>)
          : null}
       

        <div className="row px-3">
          <div className="col-4">
            <h4>Available books</h4>

            <div className="row pb-2">
              <div className="col-5">Name</div>
              <div className="col-2">Copies</div>
              <div className="col-5" />
            </div>

            {componentLoading.availableBooks
              ? this.renderLoader()
              : this.createAvailableBooksList()}
          </div>

          <div className="col-4">
            <h4>Borrowed books</h4>
            <div className="row pb-2">
              <div className="col-4">ID</div>
              <div className="col-4" >Name</div>
              <div className="col-4" />
            </div>

            {componentLoading.borrowedBooks
              ? this.renderLoader()
              : this.createBorrowedBooksList()
            }
           
          </div>

          <div className="col-3">
            <h4>Create book</h4>
            <form action="">
              <div className="form-group mt-1">
                <label className="form-label d-block">Book name</label>
                <input value={this.state.form.name} onChange={this.handleInputChange} className="form-control" type="text" name="name" />
              </div>

              <div className="form-group mt-1">
                <label className="form-label d-block">Copies count</label>
                <input value={this.state.form.availableCopies} onChange={this.handleInputChange} className="form-control" type="number" name="availableCopies" />
              </div>

              <div>
                <CustomButton type="button" onClick={this.createBook}>Create book</CustomButton>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  public renderLoader = () => {
    return (
      <div className="col-4 mx-auto"><Loader /></div>
    );
  };

  public renderNotificationBar = () => {
    return (
      <div className="row">
        <div className="col-6 mx-auto">
          <div className="">{this.state.info.message}</div>
        </div>
      </div>
    );
  };

  public render = () => {
    const {
      address,
      connected,
      chainId,
      fetching,
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
