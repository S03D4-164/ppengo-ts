import "hexdump-nodejs";

declare module "hexdump-nodejs" {
  function hexdump(buffer: Buffer, offset?: number, length?: number): string;

  export default hexdump;
}
