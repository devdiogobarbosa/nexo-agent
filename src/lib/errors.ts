export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class TicketUnavailableError extends AppError {
  constructor() {
    super(
      "TICKET_UNAVAILABLE",
      "O sistema de chamados ficou indisponível por alguns segundos. Tente de novo.",
    );
    this.name = "TicketUnavailableError";
  }
}

export class ForbiddenTicketError extends AppError {
  constructor() {
    super("FORBIDDEN_TICKET", "Esse chamado não pode ser mostrado para este usuário.");
    this.name = "ForbiddenTicketError";
  }
}

export class DuplicateTicketError extends AppError {
  constructor(readonly ticketId: string) {
    super(
      "DUPLICATE_TICKET",
      `Já existe o chamado ${ticketId} aberto sobre o mesmo problema. Ele deve ser atualizado, não duplicado.`,
    );
    this.name = "DuplicateTicketError";
  }
}

export class ReopenWindowError extends AppError {
  constructor() {
    super(
      "REOPEN_WINDOW",
      "Só é possível reabrir um chamado resolvido há até 7 dias.",
    );
    this.name = "ReopenWindowError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}
