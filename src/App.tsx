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

import { IAppState, IBookForm } from './interfaces/App-interfaces';
import * as appService from './services/app-service';

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
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

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  result: null,
  libraryContract: null,
  info: null,
  books: []
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

    const booksCount = await libraryContract.viewAllBooksCount();
    const allBooks: IBookForm[] = await this.getAllBooks(booksCount);
    const books: IBookForm[] = appService.getAvailableBooks(allBooks);

    await this.setState({ books });
    
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

  public getAllBooks = async (booksCount: number) => {
    const { libraryContract } = this.state;

    if(!libraryContract) {
      return [];
    }

    const books = await appService.getAllBooks(libraryContract, booksCount);
    return books;
  };

  public getBooksCount = async () => {
    const { libraryContract } = this.state;

    if(!libraryContract) {
      return 0;
    }

    const count = await appService.getBooksCount(libraryContract);
    return count;
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

  public createBooksList = (books: IBookForm[]) => {
    const list = [];
    let currentRow;

    for (let i = 0; i < books.length; i++) {
      currentRow = 
        <TableRow className="row pt-3">
          <div className="col-4 my-auto">{books[i].name}</div>
          <div className="col-3 my-auto">{books[i].availableCopies}</div>
          <div className="col-5 my-auto">
            <CustomButton disabled={true}>Borrow book</CustomButton>
          </div>
        </TableRow>;

      list.push(currentRow);
    }

    return list;
  };

  public renderHomeScreen = (books: IBookForm[]) => {
    return (
      <div className="row px-3">
        <div className="col-4">
          <h4>Available books</h4>

          <div className="row pb-2">
            <div className="col-4">Name</div>
            <div className="col-3">Copies left</div>
            <div className="col-5"/>
          </div>

          { this.createBooksList(books) }
        </div>

        <div className="col-4">
          <h4>Create books</h4>
        </div>

        <div className="col-4">
          <h4>Borrowed books</h4>
        </div>
      </div>
    );
  };

  public renderLoader = () => {
    return (
      <div className="col-4 mx-auto"><Loader /></div>
    );
  };

  // public renderAllBooks = (books: IBooks) => {

  // };

  public render = () => {
    const {
      address,
      connected,
      chainId,
      fetching,
      books
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
            : connected ? this.renderHomeScreen(books)
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
