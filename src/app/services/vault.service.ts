import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, catchError, of, switchMap, tap, forkJoin } from 'rxjs';
import { ethers } from 'ethers';

import { Web3Service } from './web3.service';
import { 
  Vault, 
  VaultMetadata, 
  VaultType, 
  CreateVaultRequest,  
} from '../models/vault.model';
import { 
  Transaction, 
  TransactionStatus, 
  TransactionType 
} from '../models/transaction.model';

import SingleOwnerVaultAbi from '../../contracts/core/VaultTypes/SingleOwnerVault.sol/SingleOwnerVault.json';

@Injectable({
  providedIn: 'root'
})
export class VaultService {
  private userVaults$ = new BehaviorSubject<Vault[]>([]);
  private publicVaults$ = new BehaviorSubject<Vault[]>([]);
  private currentVault$ = new BehaviorSubject<Vault | null>(null);
  private transactions$ = new BehaviorSubject<Transaction[]>([]);
  private loading$ = new BehaviorSubject<boolean>(false);
  private error$ = new BehaviorSubject<string | null>(null);

  constructor(private web3Service: Web3Service) {
    // Cuando el usuario conecta su wallet, cargamos sus vaults
    this.web3Service.getIsConnected$().pipe(
      switchMap(isConnected => {
        if (isConnected) {
          return this.loadUserVaults();
        }
        return of(null);
      })
    ).subscribe();
  }

  // Métodos públicos

  /**
   * Crea un nuevo vault tipo SingleOwner
   * @param request Datos para la creación del vault
   * @returns Observable con la dirección del nuevo vault
   */
  createSingleOwnerVault(request: CreateVaultRequest): Observable<string> {
    this.setLoading(true);
    this.setError(null);
    
    const factory = this.web3Service.getVaultFactoryContract();
    if (!factory) {
      this.setError('No se ha inicializado el contrato factory');
      this.setLoading(false);
      return of('');
    }

    const { name, description, category, imageURI, isPublic, target } = request.metadata;
    const targetAmount = ethers.parseEther(target || '0');

    return from(
      factory['createSingleOwnerVault'](
        name, 
        description, 
        category, 
        imageURI, 
        isPublic, 
        targetAmount
      )
    ).pipe(
      switchMap(tx => from(tx.wait())),
      map((receipt: any) => {
        // Buscamos el evento VaultCreated para obtener la dirección del vault
        const event = receipt.logs
          .map((log:any) => {
            try {
              return factory.interface.parseLog(log);
            } catch (e) {
              return null;
            }
          })
          .find((parsedLog:any) => parsedLog && parsedLog.name === 'VaultCreated');

        if (event && event.args && event.args.vaultAddress) {
          const vaultAddress = event.args.vaultAddress;
          // Recargar los vaults del usuario
          this.loadUserVaults().subscribe();
          return vaultAddress;
        }
        throw new Error('No se pudo obtener la dirección del vault creado');
      }),
      catchError(error => {
        console.error('Error al crear vault:', error);
        this.setError(`Error al crear vault: ${error.message || error}`);
        return of('');
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Carga los vaults propiedad del usuario conectado
   */
  loadUserVaults(): Observable<Vault[]> {
    this.setLoading(true);
    this.setError(null);
    
    const account = this.web3Service.getAccount();
    if (!account) {
      this.setError('No hay una cuenta conectada');
      this.setLoading(false);
      return of([]);
    }

    const factory = this.web3Service.getVaultFactoryContract();
    if (!factory) {
      this.setError('No se ha inicializado el contrato factory');
      this.setLoading(false);
      return of([]);
    }

    return from(factory['getVaultsByOwner'](account)).pipe(
      switchMap((vaultAddresses: string[]) => {
        if (vaultAddresses.length === 0) {
          return of([]);
        }
        
        // Para cada dirección de vault, obtener sus detalles
        // const vaultPromises = vaultAddresses.map(address => this.getVaultDetails(address));
        // return from(Promise.all(vaultPromises));
        const vaultObservables = vaultAddresses.map(address => this.getVaultDetails(address));
        return forkJoin(vaultObservables);
      }),
      tap(vaults => {
        this.userVaults$.next(vaults);
      }),
      catchError(error => {
        console.error('Error al cargar vaults del usuario:', error);
        this.setError(`Error al cargar vaults: ${error.message || error}`);
        return of([]);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Carga vaults públicos disponibles
   */
  loadPublicVaults(): Observable<Vault[]> {
    this.setLoading(true);
    this.setError(null);
    
    const factory = this.web3Service.getVaultFactoryContract();
    if (!factory) {
      this.setError('No se ha inicializado el contrato factory');
      this.setLoading(false);
      return of([]);
    }

    return from(factory['getPublicVaults']()).pipe(
      switchMap((vaultAddresses: string[]) => {
        if (vaultAddresses.length === 0) {
          return of([]);
        }
        
        // Para cada dirección de vault público, obtener sus detalles
        // const vaultPromises = vaultAddresses.map(address => this.getVaultDetails(address));
        // return from(Promise.all(vaultPromises));
        const vaultObservables = vaultAddresses.map(address => this.getVaultDetails(address));
        return forkJoin(vaultObservables);
      }),
      tap(vaults => {
        this.publicVaults$.next(vaults);
      }),
      catchError(error => {
        console.error('Error al cargar vaults públicos:', error);
        this.setError(`Error al cargar vaults públicos: ${error.message || error}`);
        return of([]);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Carga los detalles completos de un vault específico
   * @param vaultAddress Dirección del vault
   */
  loadVaultDetails(vaultAddress: string): Observable<Vault | null> {
    this.setLoading(true);
    this.setError(null);
    
    return this.getVaultDetails(vaultAddress).pipe(
      tap(vault => {
        if (vault) {
          this.currentVault$.next(vault);
          // Cargar las transacciones del vault
          this.loadVaultTransactions(vaultAddress).subscribe();
        }
      }),
      catchError(error => {
        console.error(`Error al cargar detalles del vault ${vaultAddress}:`, error);
        this.setError(`Error al cargar detalles: ${error.message || error}`);
        return of(null);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Realiza un depósito en un vault
   * @param vaultAddress Dirección del vault
   * @param amount Cantidad a depositar en ETH (como string)
   */
  depositToVault(vaultAddress: string, amount: string): Observable<Transaction | null> {
    this.setLoading(true);
    this.setError(null);
    
    const signer = this.web3Service.getSigner();
    if (!signer) {
      this.setError('No hay un signer disponible');
      this.setLoading(false);
      return of(null);
    }

    try {
      const amountWei = ethers.parseEther(amount);
      const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
      
      return from(
        vault['deposit']({ value: amountWei })
      ).pipe(
        switchMap(tx => from(tx.wait())),
        map((receipt: any) => {
          const transaction: Transaction = {
            id: receipt.hash,
            type: TransactionType.Deposit,
            status: TransactionStatus.Confirmed,
            timestamp: Math.floor(Date.now() / 1000),
            amount: amount,
            from: this.web3Service.getAccount(),
            vault: vaultAddress,
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash
          };
          
          // Actualizar las transacciones y el vault actual
          this.loadVaultDetails(vaultAddress).subscribe();
          return transaction;
        }),
        catchError(error => {
          console.error('Error al depositar:', error);
          this.setError(`Error al depositar: ${error.message || error}`);
          return of(null);
        }),
        tap(() => this.setLoading(false))
      );
    } catch (error: any) {
      console.error('Error al preparar el depósito:', error);
      this.setError(`Error al preparar el depósito: ${error.message || error}`);
      this.setLoading(false);
      return of(null);
    }
  }

  /**
   * Realiza un retiro del vault (solo para el propietario)
   * @param vaultAddress Dirección del vault
   * @param recipient Dirección del destinatario
   * @param amount Cantidad a retirar en ETH (como string)
   */
  withdrawFromVault(vaultAddress: string, recipient: string, amount: string): Observable<Transaction | null> {
    this.setLoading(true);
    this.setError(null);
    
    const signer = this.web3Service.getSigner();
    if (!signer) {
      this.setError('No hay un signer disponible');
      this.setLoading(false);
      return of(null);
    }

    try {
      const amountWei = ethers.parseEther(amount);
      const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
      
      return from(
        vault['withdraw'](recipient, amountWei)
      ).pipe(
        switchMap(tx => from(tx.wait())),
        map((receipt: any) => {
          const transaction: Transaction = {
            id: receipt.hash,
            type: TransactionType.Withdrawal,
            status: TransactionStatus.Confirmed,
            timestamp: Math.floor(Date.now() / 1000),
            amount: amount,
            from: this.web3Service.getAccount(),
            to: recipient,
            vault: vaultAddress,
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash
          };
          
          // Actualizar las transacciones y el vault actual
          this.loadVaultDetails(vaultAddress).subscribe();
          return transaction;
        }),
        catchError(error => {
          console.error('Error al retirar:', error);
          this.setError(`Error al retirar: ${error.message || error}`);
          return of(null);
        }),
        tap(() => this.setLoading(false))
      );
    } catch (error: any) {
      console.error('Error al preparar el retiro:', error);
      this.setError(`Error al preparar el retiro: ${error.message || error}`);
      this.setLoading(false);
      return of(null);
    }
  }

  /**
   * Actualiza los metadatos de un vault
   * @param vaultAddress Dirección del vault
   * @param metadata Nuevos metadatos
   */
  updateVaultMetadata(
    vaultAddress: string, 
    metadata: { name: string, description: string, category: string, imageURI: string }
  ): Observable<boolean> {
    this.setLoading(true);
    this.setError(null);
    
    const signer = this.web3Service.getSigner();
    if (!signer) {
      this.setError('No hay un signer disponible');
      this.setLoading(false);
      return of(false);
    }

    const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
    
    return from(
      vault['updateVaultConfig'](
        metadata.name,
        metadata.description,
        metadata.category,
        metadata.imageURI
      )
    ).pipe(
      switchMap(tx => from(tx.wait())),
      map(() => {
        // Actualizar el vault actual
        this.loadVaultDetails(vaultAddress).subscribe();
        return true;
      }),
      catchError(error => {
        console.error('Error al actualizar metadatos:', error);
        this.setError(`Error al actualizar metadatos: ${error.message || error}`);
        return of(false);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Cambia el estado activo/inactivo del vault
   * @param vaultAddress Dirección del vault
   * @param isActive Nuevo estado
   */
  setVaultActive(vaultAddress: string, isActive: boolean): Observable<boolean> {
    this.setLoading(true);
    this.setError(null);
    
    const signer = this.web3Service.getSigner();
    if (!signer) {
      this.setError('No hay un signer disponible');
      this.setLoading(false);
      return of(false);
    }

    const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
    
    return from(
      vault['setActive'](isActive)
    ).pipe(
      switchMap(tx => from(tx.wait())),
      map(() => {
        // Actualizar el vault actual
        this.loadVaultDetails(vaultAddress).subscribe();
        return true;
      }),
      catchError(error => {
        console.error('Error al cambiar estado activo:', error);
        this.setError(`Error al cambiar estado activo: ${error.message || error}`);
        return of(false);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Cambia la visibilidad pública/privada del vault
   * @param vaultAddress Dirección del vault
   * @param isPublic Nuevo estado de visibilidad
   */
  setVaultPublic(vaultAddress: string, isPublic: boolean): Observable<boolean> {
    this.setLoading(true);
    this.setError(null);
    
    const signer = this.web3Service.getSigner();
    if (!signer) {
      this.setError('No hay un signer disponible');
      this.setLoading(false);
      return of(false);
    }

    const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
    
    return from(
      vault['setPublic'](isPublic)
    ).pipe(
      switchMap(tx => from(tx.wait())),
      map(() => {
        // Actualizar el vault actual
        this.loadVaultDetails(vaultAddress).subscribe();
        return true;
      }),
      catchError(error => {
        console.error('Error al cambiar visibilidad:', error);
        this.setError(`Error al cambiar visibilidad: ${error.message || error}`);
        return of(false);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Agrega un depositante permitido (para vaults privados)
   * @param vaultAddress Dirección del vault
   * @param depositor Dirección del depositante a agregar
   */
  addAllowedDepositor(vaultAddress: string, depositor: string): Observable<boolean> {
    this.setLoading(true);
    this.setError(null);
    
    const signer = this.web3Service.getSigner();
    if (!signer) {
      this.setError('No hay un signer disponible');
      this.setLoading(false);
      return of(false);
    }

    const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
    
    return from(
      vault['addAllowedDepositor'](depositor)
    ).pipe(
      switchMap(tx => from(tx.wait())),
      map(() => true),
      catchError(error => {
        console.error('Error al agregar depositante:', error);
        this.setError(`Error al agregar depositante: ${error.message || error}`);
        return of(false);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Elimina un depositante permitido
   * @param vaultAddress Dirección del vault
   * @param depositor Dirección del depositante a eliminar
   */
  removeAllowedDepositor(vaultAddress: string, depositor: string): Observable<boolean> {
    this.setLoading(true);
    this.setError(null);
    
    const signer = this.web3Service.getSigner();
    if (!signer) {
      this.setError('No hay un signer disponible');
      this.setLoading(false);
      return of(false);
    }

    const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
    
    return from(
      vault['removeAllowedDepositor'](depositor)
    ).pipe(
      switchMap(tx => from(tx.wait())),
      map(() => true),
      catchError(error => {
        console.error('Error al eliminar depositante:', error);
        this.setError(`Error al eliminar depositante: ${error.message || error}`);
        return of(false);
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Verifica si una dirección puede depositar en un vault
   * @param vaultAddress Dirección del vault
   * @param depositor Dirección a verificar
   */
  canDeposit(vaultAddress: string, depositor: string): Observable<boolean> {
    const signer = this.web3Service.getSigner();
    if (!signer) {
      return of(false);
    }

    const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
    
    return from(vault['canDeposit'](depositor)).pipe(
      catchError(() => of(false))
    );
  }

  // Métodos privados

  /**
   * Obtiene los detalles de un vault a partir de su dirección
   * @param vaultAddress Dirección del vault
   */
  private getVaultDetails(vaultAddress: string): Observable<Vault> {
    const provider = this.web3Service.getProvider();
    const signer = this.web3Service.getSigner();
    
    if (!provider || !signer) {
      return of({} as Vault);
    }

    const vault = new ethers.Contract(vaultAddress, SingleOwnerVaultAbi.abi, signer);
    
    return from(vault['getVaultInfo']()).pipe(
      map(info => {
        const metadata: VaultMetadata = {
          name: info[1],
          description: info[2],
          category: info[3],
          imageURI: info[4],
          isPublic: info[5],
          target: ethers.formatEther(info[7])
        };

        return {
          address: vaultAddress,
          owner: info[0],
          balance: ethers.formatEther(info[6]),
          totalDeposited: ethers.formatEther(info[8]),
          metadata,
          type: this.mapVaultTypeFromNumber(info[9]),
          isActive: info[10]
        } as Vault;
      }),
      catchError(error => {
        console.error(`Error al obtener detalles del vault ${vaultAddress}:`, error);
        return of({} as Vault);
      })
    );
  }

  /**
   * Carga las transacciones recientes de un vault
   * @param vaultAddress Dirección del vault
   */
  private loadVaultTransactions(vaultAddress: string): Observable<Transaction[]> {
    const provider = this.web3Service.getProvider();
    if (!provider) {
      return of([]);
    }

    // Este es un placeholder. Para realmente obtener todas las transacciones
    // necesitarías integrar con TheGraph o usar eventos filtrados desde un bloque específico
    return of([]).pipe(
      tap(transactions => {
        this.transactions$.next(transactions);
      })
    );

    // En una implementación completa, usarías algo como:
    /*
    return from(
      provider.getLogs({
        address: vaultAddress,
        fromBlock: provider.getBlockNumber().then(bn => bn - 10000), // últimos 10000 bloques
        topics: [
          ethers.id("Deposit(address,uint256)"),
          ethers.id("Withdrawal(address,uint256)")
          // Otros eventos que quieras capturar
        ]
      })
    ).pipe(
      map(logs => {
        // Mapear logs a objetos Transaction
        return logs.map(log => {
          // Parsear log según su tópico...
        });
      }),
      tap(transactions => {
        this.transactions$.next(transactions);
      })
    );
    */
  }

  /**
   * Mapea el tipo numérico del vault a su enumeración
   */
  private mapVaultTypeFromNumber(vaultTypeNum: number): VaultType {
    switch (vaultTypeNum) {
      case 0:
        return VaultType.SingleOwner;
      case 1: 
        return VaultType.MultiSig;
      case 2:
        return VaultType.Timelock;
      case 3:
        return VaultType.Funding;
      default:
        return VaultType.SingleOwner;
    }
  }

  /**
   * Establece el estado de carga
   */
  private setLoading(loading: boolean): void {
    this.loading$.next(loading);
  }

  /**
   * Establece un mensaje de error
   */
  private setError(error: string | null): void {
    this.error$.next(error);
  }

  // Getters para observables

  getUserVaults$(): Observable<Vault[]> {
    return this.userVaults$.asObservable();
  }

  getPublicVaults$(): Observable<Vault[]> {
    return this.publicVaults$.asObservable();
  }

  getCurrentVault$(): Observable<Vault | null> {
    return this.currentVault$.asObservable();
  }

  getTransactions$(): Observable<Transaction[]> {
    return this.transactions$.asObservable();
  }

  getLoading$(): Observable<boolean> {
    return this.loading$.asObservable();
  }

  getError$(): Observable<string | null> {
    return this.error$.asObservable();
  }
}