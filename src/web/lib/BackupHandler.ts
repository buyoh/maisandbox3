// note: 未使用。

type AnySerializer = () => any;
type AnyDeserializer = (data: any) => void;

export class BackupHandler {
  private serializers: {
    [key: string]: { serializer: AnySerializer; deserializer: AnyDeserializer };
  };

  constructor() {
    this.serializers = {};
  }

  private pullBackupData(): any {
    const s = localStorage.getItem('msb3_backup');
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  private pushBackupData(data: any): any {
    const j = JSON.stringify(data);
    localStorage.setItem('msb3_backup', j);
  }

  handlePull(): void {
    const data = this.pullBackupData();
    if (!data) return;
    for (const key in this.serializers) {
      const d = data[key];
      if (!d) continue;
      this.serializers[key].deserializer(d);
    }
  }

  handlePush(): void {
    let data = this.pullBackupData();
    if (!data) data = {};
    for (const key in this.serializers) {
      const d = this.serializers[key].serializer();
      if (d === undefined) delete data[key];
      else data[key] = d;
    }
    this.pushBackupData(data);
  }

  addSerializer(
    uniqueKey: string,
    serializer: AnySerializer,
    deserializer: AnyDeserializer
  ): void {
    this.serializers[uniqueKey] = { serializer, deserializer };
  }
}
