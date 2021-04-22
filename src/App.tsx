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

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

interface IBooks {
  booksCount: number;
}

interface IAppState {
  fetching: boolean;
  address: string;
  library: any;
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  result: any | null;
  libraryContract: any | null;
  info: any | null;
  books: IBooks;
}

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
  books: {
    booksCount: 0
  }
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

    const booksCount = await libraryContract.viewAllBooksCount();

    await this.setState({
      provider,
      library,
      chainId: network.chainId,
      address,
      connected: true,
      libraryContract,
      books: {
        booksCount: parseInt(booksCount, 10)
      }
    });

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

  public renderHomeScreen = (books: IBooks) => {
    return (
      <div className="col-12">Books count: {books.booksCount}</div>
    );
  };

  public renderLoader = () => {
    return (
      <div className="col-4 mx-auto"><Loader /></div>
    );
  };

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
        <div className="container">

          <div className="row">
            <div className="col-12">
               <Header connected={connected} address={address} chainId={chainId} killSession={this.resetApp} />
            </div>
          </div>

          <div className="row">
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

        </div>
      </SLayout>
    );
  };
}

export default App;
