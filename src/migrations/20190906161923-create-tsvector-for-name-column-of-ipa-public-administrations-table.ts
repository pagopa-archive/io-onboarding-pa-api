import { QueryInterface } from "sequelize";

const vectorName = "_search";
const searchTableName = "IpaPublicAdministrations";
const searchColumnName = "des_amm";

export function up(
  queryInterface: QueryInterface
): Promise<ReadonlyArray<unknown>> {
  return queryInterface.sequelize.transaction(t =>
    queryInterface.sequelize
      .query(
        `
          ALTER TABLE "${searchTableName}" ADD COLUMN ${vectorName} TSVECTOR;
        `,
        { transaction: t }
      )
      .then(() =>
        queryInterface.sequelize.query(
          `
                UPDATE "${searchTableName}" SET ${vectorName} = to_tsvector('italian', ${searchColumnName});
              `,
          { transaction: t }
        )
      )
      .then(() =>
        queryInterface.sequelize.query(
          `
                CREATE INDEX ${searchTableName}_search ON "${searchTableName}" USING gin(${vectorName});
              `,
          { transaction: t }
        )
      )
      .then(() =>
        queryInterface.sequelize.query(
          `
                CREATE TRIGGER ${searchTableName}_vector_update
                BEFORE INSERT OR UPDATE ON "${searchTableName}"
                FOR EACH ROW EXECUTE PROCEDURE tsvector_update_trigger(${vectorName}, 'pg_catalog.italian', ${searchColumnName});
              `,
          { transaction: t }
        )
      )
  );
}

export function down(
  queryInterface: QueryInterface
): Promise<ReadonlyArray<unknown>> {
  return queryInterface.sequelize.transaction(t =>
    queryInterface.sequelize
      .query(
        `
          DROP TRIGGER ${searchTableName}_vector_update ON "${searchTableName}";
        `,
        { transaction: t }
      )
      .then(() =>
        queryInterface.sequelize.query(
          `
                DROP INDEX ${searchTableName}_search;
              `,
          { transaction: t }
        )
      )
      .then(() =>
        queryInterface.sequelize.query(
          `
                ALTER TABLE "${searchTableName}" DROP COLUMN ${vectorName};
              `,
          { transaction: t }
        )
      )
  );
}
