import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Web3Service } from '../../services/web3.service';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
    isConnected = false;

  constructor(private web3Service: Web3Service) {
    this.web3Service.isConnected$.subscribe(connected => {
      this.isConnected = connected;
    });
  }

  connectWallet(): void {
    this.web3Service.connectWallet();
  }
}
