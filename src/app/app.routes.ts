import { Routes } from '@angular/router';
import { VaultExploreComponent } from './components/vault-explore/vault-explore.component';
import { HomeComponent } from './components/home/home.component';
import { VaultCreateComponent } from './components/vault-create/vault-create.component';
import { VaultListComponent } from './components/vault-list/vault-list.component';

export const routes: Routes = [
    {
        path: '', redirectTo: '/home', pathMatch: 'full'
    },
    {
        path: 'home',
        component: HomeComponent
    },
    {
        path: 'explore',
        component: VaultExploreComponent
    },
    {
        path: 'create',
        component: VaultCreateComponent
    },
    {
        path: 'my-vaults',
        component: VaultListComponent
    }
];
