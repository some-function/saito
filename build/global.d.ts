import {Saito} from '../apps/core/index';

declare global {
  interface Window {
    saito: Saito;
  }
}