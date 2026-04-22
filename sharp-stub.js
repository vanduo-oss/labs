class SharpStub {
  constructor() { throw new Error('Sharp not available'); }
  static factory() { return new SharpStub(); }
}
module.exports = SharpStub;
module.exports.default = SharpStub;
