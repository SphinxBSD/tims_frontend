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

@Component({
  selector: 'app-deposit-dialog',
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
  templateUrl: './deposit-dialog.component.html',
  styleUrls: ['./deposit-dialog.component.scss']
})
export class DepositDialogComponent {
  private vaultService = inject(VaultService);
  private formBuilder = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  protected isLoading$ = this.vaultService.getLoading$();
  protected error$ = this.vaultService.getError$();
  protected depositForm: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<DepositDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vault: Vault }
  ) {
    this.depositForm = this.formBuilder.group({
      amount: ['', [Validators.required, Validators.min(0.000001), Validators.pattern(/^\d+(\.\d{1,18})?$/)]]
    });
  }

  deposit(): void {
    if (this.depositForm.invalid) {
      return;
    }

    const amount = this.depositForm.get('amount')?.value.toString();
    
    this.vaultService.depositToVault(this.data.vault.address, amount).subscribe({
      next: (transaction) => {
        if (transaction) {
          this.snackBar.open(`Depósito exitoso de ${amount} ETH`, 'Cerrar', { duration: 3000 });
          this.dialogRef.close(true);
        }
      },
      error: (err) => {
        this.snackBar.open(`Error al depositar: ${err}`, 'Cerrar', { duration: 5000 });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}