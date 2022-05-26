import 'reflect-metadata';
import {
  Column,
  DataSource,
  Entity,
  InstanceChecker,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ConnectionMetadataBuilder } from 'typeorm/connection/ConnectionMetadataBuilder';
import { EntityMetadataValidator } from 'typeorm/metadata-builder/EntityMetadataValidator';
import { ObjectUtils } from 'typeorm/util/ObjectUtils';

const log = (month: string) => {
  @Entity(`log_${month}`)
  class Log {
    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    content: string;
  }
  return Log;
};

const theDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'root',
  database: 'test',
  synchronize: true,
});

/**
 * add new entities's metadata (this code is from DataSource.prototype.buildMetadatas).
 * Note that it can be changed anytime.
 * @param dataSource DataSource
 * @param entities entities
 */
const addEntities = async (dataSource: DataSource, ...entities) => {
  const connectionMetadataBuilder = new ConnectionMetadataBuilder(dataSource);
  const entityMetadataValidator = new EntityMetadataValidator();

  // build entity metadatas
  const flattenedEntities = ObjectUtils.mixedListToArray(entities || []);
  const entityMetadatas = await connectionMetadataBuilder.buildEntityMetadatas(
    flattenedEntities
  );
  entityMetadatas.forEach((entityMetadata) => {
    if (dataSource.hasMetadata(entityMetadata.target)) {
      throw new Error(`entity ${entityMetadata.targetName} already exists`);
    } else {
      dataSource.entityMetadatas.push(entityMetadata);
    }
  });

  // validate all created entity metadatas to make sure user created entities are valid and correct
  entityMetadataValidator.validateMany(
    entityMetadatas.filter((metadata) => metadata.tableType !== 'view'),
    dataSource.driver
  );

  // set current data source to the entities
  for (let entityMetadata of entityMetadatas) {
    if (InstanceChecker.isBaseEntityConstructor(entityMetadata.target)) {
      entityMetadata.target.useDataSource(dataSource);
    }
  }
};

theDataSource.initialize().then(async () => {
  const clazz = log('202104');
  console.log(clazz);

  // add metadata
  addEntities(theDataSource, clazz);

  // Create table if needed
  await theDataSource.synchronize();

  // save log1
  const entity = new clazz();
  entity.content = 'content 1';
  await theDataSource.manager.save(entity);

  // find all
  const logs = await theDataSource.manager.find(clazz);
  console.log('logs', logs);

  // use transaction
  await theDataSource.transaction(async (em) => {
    const l = await em.findOne(clazz, {
      where: {
        id: 1,
      },
    });

    console.log('log1', l);

    l.content = 'content 1.1';
    return em.save(l);
  });

  // save log2
  const entity2 = new clazz();
  entity2.content = 'content 2';
  await theDataSource.manager.save(entity2);

  // use query builder (select)
  const l2 = await theDataSource
    .createQueryBuilder()
    .select('log')
    .from(clazz, 'log')
    .where('id = :id', {
      id: 2,
    })
    .execute();
  console.log('log2', l2);

  // use query builder (update)
  await theDataSource
    .createQueryBuilder()
    .update(clazz)
    .set({
      content: 'content 2.1',
    })
    .where({
      id: 2,
    })
    .execute();
});
