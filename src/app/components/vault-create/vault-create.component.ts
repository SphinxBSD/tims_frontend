// vault-create.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { VaultService } from '../../services/vault.service';
import { Web3Service } from '../../services/web3.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VaultType, VaultMetadata, CreateVaultRequest } from '../../models/vault.model';

@Component({
  selector: 'app-vault-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vault-create.component.html',
  styleUrls: ['./vault-create.component.scss']
})
export class VaultCreateComponent {
  private fb = inject(FormBuilder);
  private vaultService = inject(VaultService);
  private web3Service = inject(Web3Service);
  private router = inject(Router);
  
  createForm: FormGroup;
  isLoading = false;
  error = '';
  successMessage = '';
  vaultCreated = false;

  constructor() {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.maxLength(200)]],
      category: ['', Validators.required],
      imageURI: ['', Validators.required],
      isPublic: [true],
      target: ['', [Validators.required, Validators.min(0.0001)]],
      type: [VaultType.SingleOwner, Validators.required]
    });

    // Subscribe to service loading state
    this.vaultService.getLoading$()
      .pipe(takeUntilDestroyed())
      .subscribe(loading => this.isLoading = loading);

    // Subscribe to service errors
    this.vaultService.getError$()
      .pipe(takeUntilDestroyed())
      .subscribe(error => {
        if (error) {
          this.error = error;
          this.successMessage = '';
        }
      });
  }

  connectWallet() {
    this.web3Service.connectWallet()
      .catch(err => {
        console.error('Error connecting wallet:', err);
        this.error = 'Failed to connect wallet. Please try again.';
      });
  }

  onSubmit() {
    if (this.createForm.invalid || this.isLoading) return;

    const formValue = this.createForm.value;
    
    // Añadimos el tipo de vault (SingleOwner en este caso)
    const request: CreateVaultRequest = {
      metadata: {
        name: formValue.name,
        description: formValue.description,
        category: formValue.category,
        imageURI: formValue.imageURI,
        isPublic: formValue.isPublic,
        target: formValue.target.toString()
      },
      type: VaultType.SingleOwner // Añadimos el tipo requerido
    };

    this.vaultService.createSingleOwnerVault(request)
      .pipe(takeUntilDestroyed())
      .subscribe(vaultAddress => {
        if (vaultAddress) {
          this.successMessage = 'Vault created successfully!';
          this.vaultCreated = true;
          setTimeout(() => {
            this.router.navigate(['/vault', vaultAddress]);
          }, 2000);
        }
      });
  }

  get isConnected() {
    return this.web3Service.isConnected();
  }

  get account() {
    return this.web3Service.getAccount();
  }
}