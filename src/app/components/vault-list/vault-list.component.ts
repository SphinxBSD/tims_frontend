import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { VaultService } from '../../services/vault.service';
import { Web3Service } from '../../services/web3.service';
import { Vault, VaultType, VaultCategory } from '../../models/vault.model';
import { DepositDialogComponent } from '../../dialogs/deposit-dialog/deposit-dialog.component';
import { WithdrawDialogComponent } from '../../dialogs/withdraw-dialog/withdraw-dialog.component';

@Component({
  selector: 'app-vault-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './vault-list.component.html',
  styleUrls: ['./vault-list.component.scss']
})
export class VaultListComponent implements OnInit {
  private vaultService = inject(VaultService);
  private web3Service = inject(Web3Service);

  private dialog = inject(MatDialog);

  protected vaults$ = this.vaultService.getUserVaults$();
  protected currentVault$ = this.vaultService.getCurrentVault$();
  protected isLoading$ = this.vaultService.getLoading$();
  protected error$ = this.vaultService.getError$();
  protected isConnected$ = this.web3Service.getIsConnected$();

  protected VaultType = VaultType;
  protected VaultCategory = VaultCategory;

  ngOnInit(): void {
    // Forzar carga de vaults si ya está conectado
    this.isConnected$.subscribe(isConnected => {
      if (isConnected) {
        this.vaultService.loadUserVaults().subscribe();
      }
    });
  }

  openDepositDialog(vault: Vault): void {
    this.dialog.open(DepositDialogComponent, {
      data: { vault }
    });
  }

  openWithdrawDialog(vault: Vault): void {
    this.dialog.open(WithdrawDialogComponent, {
      data: { vault }
    });
  }

  connectWallet(): void {
    this.web3Service.connectWallet().catch(error => {
      console.error('Error conectando wallet:', error);
    });
  }

  selectVault(vault: Vault): void {
    this.vaultService.loadVaultDetails(vault.address).subscribe();
  }

  formatBalance(balance: string): string {
    return parseFloat(balance).toFixed(4);
  }

  getCategoryLabel(category: string): string {
    return VaultCategory[category as keyof typeof VaultCategory] || category;
  }

  isVaultOwner(vault: Vault): boolean {
    const account = this.web3Service.getAccount();
    console.log("Owner:");
    console.log(vault.owner.toLocaleLowerCase());
    console.log("Account:");
    console.log(account.toLocaleLowerCase());
    
    return vault.owner.toLowerCase() === account.toLowerCase();
  }
}