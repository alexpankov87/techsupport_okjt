import { UserService, TicketService } from '../services';

declare module 'telegraf' {
  interface Context {
    userService: UserService;
    ticketService: TicketService;
  }
}