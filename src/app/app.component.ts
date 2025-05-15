import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Web3Service } from './services/web3.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'Tims';
  isConnected = false;
  walletAddress = '';

  constructor(private web3Service: Web3Service) {}

  ngOnInit(): void {
    // Suscripciones para el estado de la wallet
    this.web3Service.isConnected$.subscribe(connected => {
      this.isConnected = connected;
    });

    this.web3Service.account$.subscribe(account => {
      this.walletAddress = account;
    });
    
  }

  connectWallet(): void {
    this.web3Service.connectWallet();
  }

  disconnectWallet(): void {
    this.web3Service.disconnectWallet();
    this.isConnected = false;
    this.walletAddress = '';
  }
  
}