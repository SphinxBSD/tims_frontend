// Representa los tipos de vaults disponibles
export enum VaultType {
    SingleOwner = "SingleOwner",
    MultiSig = "MultiSig",
    Timelock = "Timelock",
    Funding = "Funding"
}

// Representa las categorias predefinidas para los vaults
export enum VaultCategory {
    Travel = 'Viaje',
    Party = 'Fiesta',
    Medical = 'Médico',
    Emergency = 'Emergencia',
    Savings = 'Ahorro',
    Home = 'Hogar',
    Family = 'Familia',
    Education = 'Educación',
    Entertainment = 'Entretenimiento',
    Sport = 'Deporte',
    Other = 'Otro'
}

// Interface para los metadatos del vault
export interface VaultMetadata {
    name: string;
    description: string;
    category: string;
    imageURI: string;
    target: string;  // Objetivo de financiamiento (BigNumber como string)
    isPublic: boolean;
}

// Interface principal para el vault
export interface Vault {
    address: string;  // Dirección del contrato
    owner: string;    // Propietario del vault
    balance: string;  // Balance actual en wei (BigNumber como string)
    metadata: VaultMetadata;
    type: VaultType;
    createdAt?: number; // Timestamp de creación
    lastActivity?: number; // Timestamp de última actividad
}

// Interface para crear un nuevo vault
export interface CreateVaultRequest {
    metadata: VaultMetadata;
    type: VaultType;
}
