"""Create core tables for Everything Market

Revision ID: 001_create_core_tables
Revises: 
Create Date: 2025-11-22 16:57:00

This migration creates all 8 core tables in the proper dependency order:
1. stocks (no dependencies)
2. scores (FK: stocks)
3. events (no FK - event_id is external identifier)
4. llm_calls (FK: events)
5. llm_audit (FK: events)
6. score_changes (FK: events)
7. orders (independent - with ENUMs)
8. trade_history (FK: orders)

IMPORTANT: This migration does NOT seed any stock data.
Stocks must be created manually by authenticated admins only.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_create_core_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all core tables."""
    
    # ========================================================================
    # 1. stocks table (no dependencies)
    # ========================================================================
    op.create_table(
        'stocks',
        sa.Column('symbol', sa.Text(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('market_weight', sa.Float(), nullable=False),
        sa.Column('reality_weight', sa.Float(), nullable=False),
        sa.Column('min_price', sa.Float(), nullable=False),
        sa.Column('max_price', sa.Float(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('symbol'),
        sa.CheckConstraint('market_weight >= 0 AND market_weight <= 1', name='check_market_weight'),
        sa.CheckConstraint('reality_weight >= 0 AND reality_weight <= 1', name='check_reality_weight'),
        sa.CheckConstraint('min_price >= 0', name='check_min_price'),
        sa.CheckConstraint('max_price >= min_price', name='check_max_price')
    )
    
    # ========================================================================
    # 2. scores table (FK: stocks)
    # ========================================================================
    op.create_table(
        'scores',
        sa.Column('symbol', sa.Text(), nullable=False),
        sa.Column('reality_score', sa.Float(), nullable=False),
        sa.Column('final_price', sa.Float(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('last_updated', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('symbol'),
        sa.ForeignKeyConstraint(['symbol'], ['stocks.symbol'], ondelete='CASCADE'),
        sa.CheckConstraint('reality_score >= 0 AND reality_score <= 100', name='check_reality_score'),
        sa.CheckConstraint('final_price >= 0 AND final_price <= 100', name='check_final_price'),
        sa.CheckConstraint('confidence >= 0 AND confidence <= 1', name='check_confidence')
    )
    op.create_index('idx_scores_symbol', 'scores', ['symbol'])
    
    # ========================================================================
    # 3. events table (no FK - event_id is external identifier)
    # ========================================================================
    op.create_table(
        'events',
        sa.Column('id', postgresql.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('event_id', sa.Text(), nullable=False),
        sa.Column('symbol', sa.Text(), nullable=False),
        sa.Column('impact_points', sa.Float(), nullable=False),
        sa.Column('quick_score', sa.Float(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('llm_mode', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('processed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_unique_constraint('uq_events_event_id', 'events', ['event_id'])
    op.create_index('idx_events_event_id', 'events', ['event_id'], unique=True)
    op.create_index('idx_events_symbol_created', 'events', ['symbol', sa.text('created_at DESC')])
    
    # ========================================================================
    # 4. llm_calls table (FK: events)
    # ========================================================================
    op.create_table(
        'llm_calls',
        sa.Column('id', postgresql.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('event_id', sa.Text(), nullable=False),
        sa.Column('llm_mode', sa.Text(), nullable=False),
        sa.Column('input_hash', sa.Text(), nullable=False),
        sa.Column('output_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['event_id'], ['events.event_id'], ondelete='CASCADE')
    )
    op.create_index('idx_llm_calls_event', 'llm_calls', ['event_id'])
    
    # ========================================================================
    # 5. llm_audit table (FK: events)
    # ========================================================================
    op.create_table(
        'llm_audit',
        sa.Column('id', postgresql.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('event_id', sa.Text(), nullable=False),
        sa.Column('symbol', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('impact', sa.Float(), nullable=False),
        sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('approved', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('approved_by', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('approved_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['event_id'], ['events.event_id'], ondelete='CASCADE')
    )
    # Partial index for unapproved audits (performance optimization)
    op.create_index('idx_llm_audit_approved', 'llm_audit', ['approved'], 
                    postgresql_where=sa.text('NOT approved'))
    
    # ========================================================================
    # 6. score_changes table (FK: events)
    # ========================================================================
    op.create_table(
        'score_changes',
        sa.Column('id', postgresql.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('symbol', sa.Text(), nullable=False),
        sa.Column('old_score', sa.Float(), nullable=False),
        sa.Column('new_score', sa.Float(), nullable=False),
        sa.Column('delta', sa.Float(), nullable=False),
        sa.Column('event_id', sa.Text(), nullable=False),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['event_id'], ['events.event_id'], ondelete='CASCADE')
    )
    op.create_index('idx_score_changes_symbol', 'score_changes', ['symbol', sa.text('timestamp DESC')])
    
    # ========================================================================
    # 7. orders table (with ENUMs)
    # ========================================================================
    # Create ENUM types
    order_side_enum = postgresql.ENUM('buy', 'sell', name='order_side', create_type=True)
    order_type_enum = postgresql.ENUM('limit', 'market', name='order_type', create_type=True)
    order_status_enum = postgresql.ENUM('open', 'filled', 'partially_filled', 'cancelled', 
                                        name='order_status', create_type=True)
    
    op.create_table(
        'orders',
        sa.Column('order_id', postgresql.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.Text(), nullable=False),
        sa.Column('symbol', sa.Text(), nullable=False),
        sa.Column('side', order_side_enum, nullable=False),
        sa.Column('type', order_type_enum, nullable=False),
        sa.Column('price', sa.Float(), nullable=True),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('filled', sa.Float(), nullable=False, server_default=sa.text('0')),
        sa.Column('status', order_status_enum, nullable=False, server_default=sa.text("'open'")),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('order_id'),
        sa.CheckConstraint('qty > 0', name='check_qty_positive'),
        sa.CheckConstraint('filled >= 0 AND filled <= qty', name='check_filled_range')
    )
    op.create_index('idx_orders_symbol', 'orders', ['symbol'])
    op.create_index('idx_orders_user', 'orders', ['user_id'])
    # Partial index for open orders (performance optimization for matching)
    op.create_index('idx_orders_status', 'orders', ['status'], 
                    postgresql_where=sa.text("status = 'open'"))
    
    # ========================================================================
    # 8. trade_history table (FK: orders)
    # ========================================================================
    op.create_table(
        'trade_history',
        sa.Column('trade_id', postgresql.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('buy_order_id', postgresql.UUID(), nullable=False),
        sa.Column('sell_order_id', postgresql.UUID(), nullable=False),
        sa.Column('symbol', sa.Text(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('qty', sa.Float(), nullable=False),
        sa.Column('timestamp', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('trade_id'),
        sa.ForeignKeyConstraint(['buy_order_id'], ['orders.order_id']),
        sa.ForeignKeyConstraint(['sell_order_id'], ['orders.order_id']),
        sa.CheckConstraint('price > 0', name='check_price_positive'),
        sa.CheckConstraint('qty > 0', name='check_trade_qty_positive')
    )
    op.create_index('idx_trade_history_symbol', 'trade_history', ['symbol', sa.text('timestamp DESC')])
    op.create_index('idx_trade_history_buy_order', 'trade_history', ['buy_order_id'])
    op.create_index('idx_trade_history_sell_order', 'trade_history', ['sell_order_id'])


def downgrade() -> None:
    """Drop all core tables in reverse dependency order."""
    
    # Drop tables in reverse order
    op.drop_table('trade_history')
    op.drop_table('orders')
    op.drop_table('score_changes')
    op.drop_table('llm_audit')
    op.drop_table('llm_calls')
    op.drop_table('events')
    op.drop_table('scores')
    op.drop_table('stocks')
    
    # Drop ENUM types
    op.execute('DROP TYPE IF EXISTS order_side CASCADE')
    op.execute('DROP TYPE IF EXISTS order_type CASCADE')
    op.execute('DROP TYPE IF EXISTS order_status CASCADE')
