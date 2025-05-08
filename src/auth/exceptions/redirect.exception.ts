import { HttpException, HttpStatus } from '@nestjs/common';

export class RedirectException extends HttpException {
  constructor(readonly url: string) {
    super('Redirect', HttpStatus.FOUND);
  }
}
