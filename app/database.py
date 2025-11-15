"""Database connection and query utilities for PostgreSQL"""

import os
from typing import Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool


class DatabaseManager:
    """Manages PostgreSQL database connections and queries"""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[SimpleConnectionPool] = None

    def initialize_pool(self, minconn: int = 1, maxconn: int = 10) -> None:
        """Initialize connection pool"""
        if self.pool is None:
            self.pool = SimpleConnectionPool(minconn, maxconn, self.database_url)

    def get_connection(self):
        """Get connection from pool"""
        if self.pool is None:
            self.initialize_pool()
        return self.pool.getconn()

    def return_connection(self, conn) -> None:
        """Return connection to pool"""
        if self.pool:
            self.pool.putconn(conn)

    def execute_query(
        self, query: str, params: tuple = (), fetch: bool = True
    ) -> Optional[list[dict[str, Any]]]:
        """Execute a query and return results"""
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                if fetch:
                    result = cursor.fetchall()
                    return [dict(row) for row in result]
                conn.commit()
                return None
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                self.return_connection(conn)

    def execute_one(
        self, query: str, params: tuple = ()
    ) -> Optional[dict[str, Any]]:
        """Execute a query and return single result"""
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                self.return_connection(conn)

    def execute_insert(
        self, query: str, params: tuple = ()
    ) -> Optional[dict[str, Any]]:
        """Execute INSERT and return the inserted row"""
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()
                conn.commit()
                return dict(result) if result else None
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                self.return_connection(conn)

    def close_all(self) -> None:
        """Close all connections in pool"""
        if self.pool:
            self.pool.closeall()
