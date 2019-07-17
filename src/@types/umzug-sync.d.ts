declare module "umzug-sync" {
  import { Sequelize } from "sequelize";

  interface IConfiguration {
    sequelize: Sequelize;
    SequelizeImport: typeof Sequelize;
    migrationsDir: string;
    chdir?: string;
    logging?: (param: string) => void;
    timeout?: number;
  }

  export function migrate(conf: IConfiguration): Promise<void>;
}
