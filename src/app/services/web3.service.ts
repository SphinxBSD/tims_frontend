import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { ethers } from 'ethers';

import VaultFactoryAbi from '../../contracts/core/VaultFactory.sol/VaultFactory.json';
import SingleOwnerVaultAbi from '../../contracts/core/VaultTypes/SingleOwnerVault.sol/SingleOwnerVault.json';

import { MetaMaskInpageProvider } from '@metamask/providers';
declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}

@Injectable({
  providedIn: 'root'
})
export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private vaultFactoryContract: ethers.Contract | null = null;
  
  // Configuración de contratos según red
  private contractConfig: Record<string, { factoryAddress: string }> = {
    // Sepolia (11155111)
    '11155111': {
      factoryAddress: '0xf1Da8fA04bE703cC52bc8Ac269a439111FeaD838' // Reemplazar con la dirección real en Sepolia
    },
    // Puedes agregar más redes aquí según sea necesario
    // Hardhat local (31337)
    '31337': {
      factoryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
    }
  };

  // La red objetivo para la aplicación
  private readonly targetNetworkId = 11155111; // Sepolia
  private readonly networkNames: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    31337: 'Hardhat Local',
  };

  // BehaviorSubjects para exponer el estado
  public isConnected$ = new BehaviorSubject<boolean>(false);
  public account$ = new BehaviorSubject<string>('');
  public networkId$ = new BehaviorSubject<number>(0);
  public vaultContract$ = new BehaviorSubject<ethers.Contract | null>(null);
  public isCorrectNetwork$ = new BehaviorSubject<boolean>(false);
  public networkName$ = new BehaviorSubject<string>('');
  public walletModalVisible$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // Verificamos si hay una sesión guardada
    this.checkForSavedSession();
    
    // Configurar listeners globales para eventos de Ethereum
    this.setupGlobalEventListeners();
  }

  /**
   * Verifica si hay una sesión guardada en localStorage
   */
  private checkForSavedSession(): void {
    const savedAccount = localStorage.getItem('walletAddress');
    const savedNetwork = localStorage.getItem('networkId');
    
    if (savedAccount && savedNetwork) {
      // Si hay información guardada, intentamos reconectar silenciosamente
      this.silentlyReconnect();
    }
  }

  /**
   * Intenta reconectar sin solicitar permiso al usuario
   */
  private async silentlyReconnect(): Promise<void> {
    if (window.ethereum) {
      try {
        // Intenta obtener las cuentas sin pedir permiso
        const accounts = await window.ethereum.request({
          method: 'eth_accounts'
        });
        
        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          // Si tenemos acceso a una cuenta, inicializamos web3
          await this.initializeWeb3WithAccount(accounts[0] as string);
        }
      } catch (error) {
        console.error('Error reconectando silenciosamente:', error);
      }
    }
  }

  /**
   * Inicializa el proveedor y contratos con una cuenta específica
   */
  private async initializeWeb3WithAccount(account: string): Promise<void> {
    try {
      this.provider = new ethers.BrowserProvider(window.ethereum!);
      this.account$.next(account);
      
      // Obtenemos el signer
      this.signer = await this.provider.getSigner();

      // Obtenemos el ID de la red
      const network = await this.provider.getNetwork();
      const networkId = Number(network.chainId);
      this.networkId$.next(networkId);
      
      // Verificamos si es la red correcta
      const isCorrectNetwork = networkId === this.targetNetworkId;
      this.isCorrectNetwork$.next(isCorrectNetwork);
      
      // Actualizamos el nombre de la red
      this.networkName$.next(this.getNetworkName(networkId));

      // Inicializamos los contratos si estamos en la red correcta
      if (isCorrectNetwork) {
        await this.initContracts(networkId);
      } else {
        console.warn(`Red incorrecta. Conectado a ${this.getNetworkName(networkId)}, pero se requiere ${this.getNetworkName(this.targetNetworkId)}`);
      }
      
      this.isConnected$.next(true);
      
      // Guardamos en localStorage
      localStorage.setItem('walletAddress', account);
      localStorage.setItem('networkId', networkId.toString());
    } catch (error) {
      console.error('Error inicializando Web3 con cuenta:', error);
      this.resetState();
    }
  }

  /**
   * Configura listeners para eventos de Ethereum a nivel global
   */
  private setupGlobalEventListeners(): void {
    if (window.ethereum) {
      // Cuando cambian las cuentas
      window.ethereum.on('accountsChanged', (accounts: unknown) => {
        if (Array.isArray(accounts) && accounts.length > 0) {
          const account = accounts[0] as string;
          this.account$.next(account);
          localStorage.setItem('walletAddress', account);
        } else {
          // Si se desconecta la cuenta desde MetaMask
          this.disconnectWallet();
        }
      });

      // Cuando cambia la red
      window.ethereum.on('chainChanged', async (chainIdHex: unknown) => {
        if (typeof chainIdHex === 'string') {
          const networkId = parseInt(chainIdHex, 16);
          this.networkId$.next(networkId);
          
          // Verificamos si es la red correcta
          const isCorrectNetwork = networkId === this.targetNetworkId;
          this.isCorrectNetwork$.next(isCorrectNetwork);
          
          // Actualizamos el nombre de la red
          this.networkName$.next(this.getNetworkName(networkId));
          
          // Actualizamos los contratos para la nueva red
          if (isCorrectNetwork && this.signer) {
            await this.initContracts(networkId);
          } else {
            this.vaultContract$.next(null);
          }
          
          localStorage.setItem('networkId', networkId.toString());
        }
      });

      // Cuando se desconecta
      window.ethereum.on('disconnect', () => {
        this.disconnectWallet();
      });
    }
  }

  /**
   * Inicializa Web3 y solicita conexión al usuario
   */
  async initWeb3(): Promise<void> {
    // Verificamos si MetaMask está instalado
    if (!window.ethereum) {
      throw new Error('MetaMask no está instalado. Por favor instala MetaMask para usar esta aplicación.');
    }
    
    try {
      this.provider = new ethers.BrowserProvider(window.ethereum);

      // Solicitamos acceso a la cuenta
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No se pudo obtener acceso a las cuentas de MetaMask');
      }
      
      const account = accounts[0] as string;
      this.account$.next(account);
      localStorage.setItem('walletAddress', account);

      // Obtenemos el signer
      this.signer = await this.provider.getSigner();

      // Obtenemos el ID de la red
      const network = await this.provider.getNetwork();
      const networkId = Number(network.chainId);
      this.networkId$.next(networkId);
      
      // Verificamos si es la red correcta
      const isCorrectNetwork = networkId === this.targetNetworkId;
      this.isCorrectNetwork$.next(isCorrectNetwork);
      
      // Actualizamos el nombre de la red
      this.networkName$.next(this.getNetworkName(networkId));

      // Si no estamos en la red correcta, solicitamos cambiar
      if (!isCorrectNetwork) {
        await this.switchToTargetNetwork();
      }

      // Inicializamos los contratos
      await this.initContracts(this.networkId$.getValue());
      
      this.isConnected$.next(true);
      localStorage.setItem('networkId', networkId.toString());
    } catch (error) {
      console.error('Error inicializando Web3:', error);
      this.resetState();
      throw error;
    }
  }

  /**
   * Intenta cambiar a la red objetivo (Sepolia)
   */
  async switchToTargetNetwork(): Promise<void> {
    if (!window.ethereum) return;
    
    try {
      // Intentamos cambiar a la red objetivo
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${this.targetNetworkId.toString(16)}` }],
      });
    } catch (error: any) {
      // Si el error es que la red no está configurada en MetaMask
      if (error.code === 4902) {
        try {
          // Añadimos la red Sepolia a MetaMask
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${this.targetNetworkId.toString(16)}`,
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/']
              }
            ],
          });
        } catch (addError) {
          console.error('Error añadiendo la red Sepolia a MetaMask:', addError);
          throw addError;
        }
      } else {
        console.error('Error cambiando a la red Sepolia:', error);
        throw error;
      }
    }
  }

  /**
   * Inicializa los contratos según la red
   */
  private async initContracts(networkId: number): Promise<void> {
    try {
      if (!this.signer) {
        throw new Error('No hay un signer disponible');
      }

      // Obtenemos la configuración para la red actual
      const config = this.contractConfig[networkId.toString()];
      if (!config) {
        throw new Error(`No hay configuración para la red ${networkId}`);
      }

      // Inicializamos el contrato factory
      this.vaultFactoryContract = new ethers.Contract(
        config.factoryAddress,
        VaultFactoryAbi.abi,
        this.signer
      );
      
      this.vaultContract$.next(this.vaultFactoryContract);
    } catch (error) {
      console.error('Error inicializando contratos:', error);
      this.vaultContract$.next(null);
      throw error;
    }
  }

  /**
   * Conecta la wallet solicitando permiso al usuario
   */
  async connectWallet(): Promise<void> {
    this.walletModalVisible$.next(false);
    
    try {
      if (!this.provider) {
        await this.initWeb3();
        return;
      }

      const accounts = await window.ethereum?.request({ method: 'eth_requestAccounts' });
      if (accounts && Array.isArray(accounts) && accounts.length > 0) {
        const account = accounts[0] as string;
        this.account$.next(account);
        this.isConnected$.next(true);
        
        localStorage.setItem('walletAddress', account);
        
        // Inicializamos el signer y los contratos si aún no se ha hecho
        if (!this.signer) {
          this.signer = await this.provider.getSigner();
          
          // Verificamos si estamos en la red correcta
          const networkId = this.networkId$.getValue();
          const isCorrectNetwork = networkId === this.targetNetworkId;
          
          if (!isCorrectNetwork) {
            await this.switchToTargetNetwork();
          }
          
          await this.initContracts(this.networkId$.getValue());
        }
      }
    } catch (error) {
      console.error('Usuario rechazó la conexión o hubo un error:', error);
      this.walletModalVisible$.next(true);
      throw error;
    }
  }

  /**
   * Desconecta la wallet limpiando el estado y localStorage
   */
  disconnectWallet(): void {
    this.resetState();
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('networkId');
  }

  /**
   * Restablece el estado del servicio
   */
  private resetState(): void {
    this.account$.next('');
    this.isConnected$.next(false);
    this.signer = null;
    this.provider = null;
    this.vaultFactoryContract = null;
    this.vaultContract$.next(null);
    this.isCorrectNetwork$.next(false);
  }

  /**
   * Obtiene el nombre de la red según su ID
   */
  private getNetworkName(networkId: number): string {
    return this.networkNames[networkId] || `Red desconocida (${networkId})`;
  }

  /**
   * Verifica si estamos conectados a la red objetivo
   */
  async ensureCorrectNetwork(): Promise<boolean> {
    const currentNetworkId = this.networkId$.getValue();
    
    if (currentNetworkId !== this.targetNetworkId) {
      try {
        await this.switchToTargetNetwork();
        return true;
      } catch (error) {
        console.error('Error cambiando a la red objetivo:', error);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Obtiene el balance de ETH de una dirección
   */
  async getAddressBalance(address: string): Promise<string> {
    if (!this.provider) {
      throw new Error('No hay un proveedor disponible');
    }
    
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error obteniendo balance:', error);
      throw error;
    }
  }

  /**
   * Obtiene un objeto para interactuar con un contrato de vault
   */
  getVaultContract(vaultAddress: string): ethers.Contract | null {
    if (!this.signer) {
      return null;
    }
    
    try {
      return new ethers.Contract(
        vaultAddress,
        SingleOwnerVaultAbi.abi,
        this.signer
      );
    } catch (error) {
      console.error('Error creando contrato de vault:', error);
      return null;
    }
  }

  /**
   * Verifica si hay suficiente ETH para la transacción más gas
   */
  async hasEnoughBalance(amount: string): Promise<boolean> {
    if (!this.provider || !this.account$.getValue()) {
      return false;
    }
    
    try {
      const balance = await this.provider.getBalance(this.account$.getValue());
      const amountWei = ethers.parseEther(amount);
      const gasEstimate = ethers.parseEther('0.01'); // Estimación conservadora del gas
      
      return balance >= (amountWei + gasEstimate);
    } catch (error) {
      console.error('Error verificando balance:', error);
      return false;
    }
  }

  /**
   * Obtiene Sepolia ETH para pruebas (redirecciona a un faucet)
   */
  getSepETH(): void {
    window.open('https://sepoliafaucet.com/', '_blank');
  }

  /**
   * Abre el modal de conexión de wallet
   */
  openConnectWalletModal(): void {
    this.walletModalVisible$.next(true);
  }

  /**
   * Cierra el modal de conexión de wallet
   */
  closeConnectWalletModal(): void {
    this.walletModalVisible$.next(false);
  }

  // Getters públicos para los estados

  getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  getSigner(): ethers.JsonRpcSigner | null {
    return this.signer;
  }

  getAccount(): string {
    return this.account$.getValue();
  }

  getNetworkId(): number {
    return this.networkId$.getValue();
  }

  getVaultFactoryContract(): ethers.Contract | null {
    return this.vaultFactoryContract;
  }

  isConnected(): boolean {
    return this.isConnected$.getValue();
  }

  isCorrectNetwork(): boolean {
    return this.isCorrectNetwork$.getValue();
  }

  getNetworkNameText(): string {
    return this.networkName$.getValue();
  }

  getTargetNetworkName(): string {
    return this.getNetworkName(this.targetNetworkId);
  }

  // Observables públicos para los estados

  getAccount$(): Observable<string> {
    return this.account$.asObservable();
  }

  getIsConnected$(): Observable<boolean> {
    return this.isConnected$.asObservable();
  }

  getNetworkId$(): Observable<number> {
    return this.networkId$.asObservable();
  }

  getVaultFactoryContract$(): Observable<ethers.Contract | null> {
    return this.vaultContract$.asObservable();
  }

  getIsCorrectNetwork$(): Observable<boolean> {
    return this.isCorrectNetwork$.asObservable();
  }

  getNetworkName$(): Observable<string> {
    return this.networkName$.asObservable();
  }

  getWalletModalVisible$(): Observable<boolean> {
    return this.walletModalVisible$.asObservable();
  }
}