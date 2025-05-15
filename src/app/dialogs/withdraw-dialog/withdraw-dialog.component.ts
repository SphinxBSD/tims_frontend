import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { VaultService } from '../../services/vault.service';
import { Vault } from '../../models/vault.model';
import { ethers } from 'ethers';

@Component({
  selector: 'app-withdraw-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './withdraw-dialog.component.html',
  styleUrls: ['./withdraw-dialog.component.scss']
})
export class WithdrawDialogComponent {
  private vaultService = inject(VaultService);
  private formBuilder = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  protected isLoading$ = this.vaultService.getLoading$();
  protected error$ = this.vaultService.getError$();
  protected withdrawForm: FormGroup;
  protected maxAmount: string;

  constructor(
    private dialogRef: MatDialogRef<WithdrawDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vault: Vault }
  ) {
    this.maxAmount = this.data.vault.balance;
    
    this.withdrawForm = this.formBuilder.group({
      amount: ['', [
        Validators.required, 
        Validators.min(0.000001), 
        Validators.max(parseFloat(this.maxAmount)),
        Validators.pattern(/^\d+(\.\d{1,18})?$/)
      ]],
      recipient: ['', [
        Validators.required,
        Validators.pattern(/^0x[a-fA-F0-9]{40}$/)
      ]]
    });
  }

  withdraw(): void {
    if (this.withdrawForm.invalid) {
      return;
    }

    const amount = this.withdrawForm.get('amount')?.value;
    const recipient = this.withdrawForm.get('recipient')?.value;
    
    if (parseFloat(amount) > parseFloat(this.maxAmount)) {
      this.snackBar.open(`El monto excede el balance disponible (${this.maxAmount} ETH)`, 'Cerrar', { duration: 3000 });
      return;
    }
    
    this.vaultService.withdrawFromVault(this.data.vault.address, recipient, amount).subscribe({
      next: (transaction) => {
        if (transaction) {
          this.snackBar.open(`Retiro exitoso de ${amount} ETH a ${recipient.substring(0, 8)}...`, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        }
      },
      error: (err) => {
        this.snackBar.open(`Error al retirar: ${err}`, 'Cerrar', { duration: 5000 });
      }
    });
  }

  useMaxAmount(): void {
    this.withdrawForm.get('amount')?.setValue(this.maxAmount);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  validateAmount(): void {
    const amountControl = this.withdrawForm.get('amount');
    if (amountControl?.value && parseFloat(amountControl.value) > parseFloat(this.maxAmount)) {
      amountControl.setErrors({ max: true });
    }
  }
}