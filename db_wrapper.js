import fs from 'fs'
import sqlite3 from 'sqlite3'
import EventEmitter from 'events'

let instance = null;

export default class SqlWrapper extends EventEmitter {

  constructor(config) {
    super();

    // if necessary
    if (instance && instance.config != config) {
     instance.close();
     instance = null;
    }

    if (!instance) {
      this.config = config
      this.db = new sqlite3.Database(this.config);
      this.cache = {};
      this.on('cache', this.onCache)
      instance = this;
      this.counter = 1;
    }
    this.counter = this.counter + 1;
    return instance;
  }

  // pump when schema is not set or not the latest
  async pump(filename) {
    let content = fs.readFileSync(filename, { encoding: 'utf8' });
    let sqls = content.split('\n');
    sqls = sqls.filter(function (item) {
      if (!item || item[0] == '#')
        return false;
      return true;
    })
    // catch error
    for (let index in sqls) {
      await this.query(sqls[index], false);
    }
    this.cache = {};
  }

  // console only support crud
  console(sql) {
    let methodReg = /(^\s*(select|update|insert|delete)\s+)/;
    // catch error when sql is invalid
    let crudMethod = undefined;
    try {
      crudMethod = sql.toLowerCase().match(methodReg)[0].trim();
    } catch (error) {
      return new Promise.reject("error: sytax error in sql");
    }
    if (crudMethod == 'select') {
      if (this.cache.hasOwnProperty(sql.toLowerCase())) {
        return new Promise((resolve, reject) => {
          resolve(this.cache[sql.toLowerCase()]);
        })
      }
      return this.query(sql, true);
    }
    else {
      this.counter += 1;
      this.cache = {};
      return this.query(sql);
    }
  }

  query(sql, cache = false) {
    let that = this;
    return new Promise((resolve, reject) => {
      that.db.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        }
        if (cache) {
          that.emit('cache', sql, rows);
        }
        resolve(rows);
      })
    })
  }

  onCache(sql, rows) {
    //this could use Symbol feature
    this.cache[sql.toLowerCase().trim()] = rows;
  }
  
  close() {
    this.counter = this.counter - 1;
    if (this.counter == 0) {
      this.db.close();
      this.instance = null;
    }
  }
}
