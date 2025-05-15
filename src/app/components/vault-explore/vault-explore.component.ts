import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { VaultService } from '../../services/vault.service';
import { Web3Service } from '../../services/web3.service';
import { Vault } from '../../models/vault.model';


@Component({
  selector: 'app-vault-explore',
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './vault-explore.component.html',
  styleUrl: './vault-explore.component.scss'
})
export class VaultExploreComponent {
  publicVaults: Vault[] = [];
  filteredVaults: Vault[] = [];
  categories: string[] = [];
  loading = true;
  isConnected = false;

  // Filters
  searchTerm = '';
  selectedCategory = '';
  sortBy = 'newest';

  constructor(
    private vaultService: VaultService,
    private web3Service: Web3Service,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.web3Service.isConnected$.subscribe(connected => {
      this.isConnected = connected;
    });

    // this.vaultService.getPublicVaults().subscribe(vaults => {
    //   this.publicVaults = vaults;
    //   this.filteredVaults = [...vaults];
    //   this.extractCategories();
    //   this.applyFilters();
    //   this.loading = false;
    // });

    // Initial load
    this.loadVaults();
  }

  loadVaults(): void {
    this.loading = false;
    // this.vaultService.loadPublicVaults().then(() => {
    //   this.loading = false;
    // }).catch(error => {
    //   console.error('Error loading public vaults:', error);
    //   this.loading = false;
    //   this.snackBar.open('Failed to load vaults. Please try again later.', 'Close', {
    //     duration: 5000,
    //   });
    // });
  }

  extractCategories(): void {
    const categoriesSet = new Set<string>();
    // this.publicVaults.forEach(vault => {
    //   if (vault.category) {
    //     categoriesSet.add(vault.category);
    //   }
    // });
    // this.categories = Array.from(categoriesSet);
  }

  applyFilters(): void {
    let filtered = [...this.publicVaults];

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      // filtered = filtered.filter(vault => 
      //   vault.name.toLowerCase().includes(term) || 
      //   vault.description.toLowerCase().includes(term)
      // );
    }

    // Apply category filter
    if (this.selectedCategory) {
      // filtered = filtered.filter(vault => vault.category === this.selectedCategory);
    }

    // Apply sorting
    switch (this.sortBy) {
      // case 'newest':
      //   filtered.sort((a, b) => b.createdAt - a.createdAt);
      //   break;
      // case 'oldest':
      //   filtered.sort((a, b) => a.createdAt - b.createdAt);
      //   break;
      // case 'nameAsc':
      //   filtered.sort((a, b) => a.name.localeCompare(b.name));
      //   break;
      // case 'nameDesc':
      //   filtered.sort((a, b) => b.name.localeCompare(a.name));
      //   break;
      // case 'balanceHighest':
      //   filtered.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
      //   break;
      // case 'balanceLowest':
      //   filtered.sort((a, b) => parseFloat(a.balance) - parseFloat(b.balance));
      //   break;
    }

    this.filteredVaults = filtered;
  }

  getVaultIcon(category: string): string {
    const categoryIcons: {[key: string]: string} = {
      'Personal': 'person',
      'Business': 'business',
      'Charity': 'volunteer_activism',
      'Education': 'school',
      'Health': 'local_hospital',
      'Technology': 'computer',
      'Art': 'palette',
      'Community': 'people',
      'Other': 'category'
    };

    return categoryIcons[category] || 'account_balance';
  }

  getProgressPercentage(balance: string, target: string): number {
    const balanceNum = parseFloat(balance);
    const targetNum = parseFloat(target);
    
    if (targetNum <= 0 || isNaN(targetNum) || isNaN(balanceNum)) {
      return 0;
    }
    
    const percentage = (balanceNum / targetNum) * 100;
    return Math.min(percentage, 100);
  }

  getFormattedDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString();
  }
}
