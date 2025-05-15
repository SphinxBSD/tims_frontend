// Tipos de transacciones
export enum TransactionType {
    Deposit = "Deposit",
    Withdrawal = "Withdrawal",
    MetadataUpdate = "MetadataUpdate",
    OwnershipTransfer = "OwnershipTransfer"
}

// Estados de la transaccion
export enum TransactionStatus {
    Pending = "Pending",
    Confirmed = "Confirmed",
    Failed = "Failed"
}

// Interface para las transacciones
export interface Transaction {
    id: string;          // Hash de la transaccion
    type: TransactionType;
    status: TransactionStatus;
    timestamp: number;
    amount?: string;    // Para depósitos y retiros (BigNumber como string)
    from: string;       // Dirección que inició la tx
    to?: string;        // Dirección receptora (para retiros)
    vault: string;      // Dirección del vault
    blockNumber?: number;
    blockHash?: string;
}

// Interface para filtros de transacciones
export interface TransactionFilter {
    vault?: string;
    type?: TransactionType;
    from?: string;
    to?: string;
    startDate?: number;
    endDate?: number;
}